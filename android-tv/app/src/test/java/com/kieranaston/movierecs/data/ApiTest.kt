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
    private lateinit var api: Api

    @Before fun setUp() {
        server.start()
        api = Api(server.url("/").toString(), OkHttpClient())
    }

    @After fun tearDown() = server.close()

    private fun respond(code: Int, body: String = "") = server.enqueue(MockResponse.Builder().code(code).body(body).build())

    @Test fun `parses responses`() = runTest {
        respond(200, """{"mode":"sections","sections":[{"id":"top_rated","label":"Top Rated","total":1,"movies":[{"tmdbId":155,"title":"The Dark Knight","year":2008,"posterPath":"/p.jpg","voteAverage":8.5,"extra":"ignored"}]}]}""")
        val browse = api.browse(genre = "action", filter = null)
        assertEquals("The Dark Knight", browse.sections.single().movies.single().title)

        val request = server.takeRequest()
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

    @Test fun `throws on error responses`() {
        respond(429, """{"error":"Too many requests"}""")
        assertThrows(ApiException::class.java) { runBlocking { api.genres() } }
    }
}
