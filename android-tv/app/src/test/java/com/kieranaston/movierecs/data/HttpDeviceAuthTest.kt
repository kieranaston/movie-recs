package com.kieranaston.movierecs.data

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout

class HttpDeviceAuthTest {
    @get:Rule val timeout: Timeout = Timeout.seconds(20)
    private val server = MockWebServer()
    private lateinit var auth: HttpDeviceAuth

    @Before fun setUp() {
        server.start()
        auth = HttpDeviceAuth(server.url("/").toString(), OkHttpClient())
    }

    @After fun tearDown() = server.close()

    private fun respond(code: Int, body: String) = server.enqueue(MockResponse.Builder().code(code).body(body).build())
    private fun bodyOf(raw: String) = Json.parseToJsonElement(raw).jsonObject

    @Test fun `requests a code as the TV client`() = runTest {
        respond(200, """{"device_code":"d","user_code":"WDJBMJHT","verification_uri":"https://x/activate","verification_uri_complete":"https://x/activate?user_code=WDJBMJHT","expires_in":600,"interval":5}""")
        val code = auth.requestCode()
        assertEquals("WDJBMJHT", code.userCode)
        assertEquals(5, code.interval)
        val request = server.takeRequest()
        assertEquals("/api/auth/device/code", request.url.encodedPath)
        assertEquals("movie-recs-tv", bodyOf(request.body!!.utf8())["client_id"]!!.jsonPrimitive.content)
    }

    @Test fun `maps every token-endpoint answer`() = runTest {
        respond(400, """{"error":"authorization_pending"}"""); assertEquals(PollResult.Pending, auth.poll("d"))
        respond(400, """{"error":"slow_down"}"""); assertEquals(PollResult.SlowDown, auth.poll("d"))
        respond(400, """{"error":"access_denied"}"""); assertEquals(PollResult.Denied, auth.poll("d"))
        respond(400, """{"error":"expired_token"}"""); assertEquals(PollResult.Expired, auth.poll("d"))
        respond(400, """{"error":"invalid_grant"}"""); assertEquals(PollResult.Expired, auth.poll("d"))
        respond(200, """{"access_token":"tok","token_type":"Bearer","expires_in":2592000}"""); assertEquals(PollResult.Granted("tok"), auth.poll("d"))

        val first = bodyOf(server.takeRequest().body!!.utf8())
        assertEquals("urn:ietf:params:oauth:grant-type:device_code", first["grant_type"]!!.jsonPrimitive.content)
        assertEquals("d", first["device_code"]!!.jsonPrimitive.content)
        assertEquals("movie-recs-tv", first["client_id"]!!.jsonPrimitive.content)
    }

    @Test fun `treats unexpected errors as failures`() = runTest {
        respond(500, "oops")
        assertThrows(ApiException::class.java) { kotlinx.coroutines.runBlocking { auth.poll("d") } }
    }

    @Test fun `identifies and signs out with the bearer token`() = runTest {
        respond(200, """{"email":"alice@example.com","name":"Alice"}""")
        assertEquals("alice@example.com", auth.me("tok").email)
        assertEquals("Bearer tok", server.takeRequest().headers["Authorization"])

        respond(200, """{"success":true}""")
        auth.signOut("tok")
        val signOut = server.takeRequest()
        assertEquals("/api/auth/sign-out", signOut.url.encodedPath)
        assertEquals("POST", signOut.method)
        assertEquals("Bearer tok", signOut.headers["Authorization"])
    }
}
