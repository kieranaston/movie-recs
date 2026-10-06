package com.kieranaston.movierecs.data

import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout

class ApiTest {
    @get:Rule val timeout: Timeout = Timeout.seconds(20)
    private val server = MockWebServer()
    private var token: String? = "tok"
    private var unauthorized = 0
    private lateinit var api: Api

    @Before fun setUp() {
        server.start()
        api = Api(server.url("/").toString(), OkHttpClient(), token = { token }, onUnauthorized = { unauthorized++ })
    }

    @After fun tearDown() = server.close()

    private fun respond(code: Int, body: String = "") = server.enqueue(MockResponse.Builder().code(code).body(body).build())

    @Test fun `sends the session token and parses responses`() = runTest {
        respond(200, """{"mode":"sections","sections":[{"id":"top_rated","label":"Top Rated","total":1,"movies":[{"tmdbId":155,"title":"The Dark Knight","year":2008,"posterPath":"/p.jpg","voteAverage":8.5,"extra":"ignored"}]}]}""")
        val browse = api.browse(genre = "action", filter = null)
        assertEquals("The Dark Knight", browse.sections.single().movies.single().title)

        val request = server.takeRequest()
        assertEquals("Bearer tok", request.headers["Authorization"])
        assertEquals("/api/v1/browse", request.url.encodedPath)
        assertEquals("action", request.url.queryParameter("genre"))
        assertNull(request.url.queryParameter("filter")) // nulls are omitted
    }

    @Test fun `adds and removes watchlist titles by id only`() = runTest {
        respond(204); respond(204)
        api.addToWatchlist(155)
        api.removeFromWatchlist(155)
        val put = server.takeRequest()
        assertEquals("PUT", put.method)
        assertEquals("/api/v1/watchlist/155", put.url.encodedPath)
        assertEquals(0L, put.bodySize)
        assertEquals("DELETE", server.takeRequest().method)
    }

    @Test fun `a 401 signs the TV out`() {
        respond(401, """{"error":"Unauthorized"}""")
        val e = assertThrows(ApiException::class.java) { runBlocking { api.watchlist() } }
        assertEquals(401, e.code)
        assertEquals(1, unauthorized)
    }

    @Test fun `other errors do not`() {
        respond(429, """{"error":"Too many requests"}""")
        assertThrows(ApiException::class.java) { runBlocking { api.genres() } }
        assertEquals(0, unauthorized)
    }

    @Test fun `never calls the server without a session`() {
        token = null
        assertThrows(ApiException::class.java) { runBlocking { api.genres() } }
        assertEquals(1, unauthorized)
        assertEquals(0, server.requestCount)
    }
}
