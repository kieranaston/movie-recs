package com.kieranaston.movierecs.data

import java.util.concurrent.TimeUnit
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout

/** Real HTTP against a local MockWebServer, so these run on real dispatchers with bounded waits. */
class WatchlistRepositoryTest {
    @get:Rule val timeout: Timeout = Timeout.seconds(20)

    private val server = MockWebServer()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var repo: WatchlistRepository

    private val arrival = Movie(329865, "Arrival", 2016, "/a.jpg", 7.6)
    private val heat = Movie(949, "Heat", 1995, "/h.jpg", 7.9)

    @Before fun setUp() {
        server.start()
        val api = Api(server.url("/").toString(), OkHttpClient())
        repo = WatchlistRepository(api, scope)
    }

    @After fun tearDown() {
        scope.cancel()
        server.close()
    }

    private fun respond(code: Int, body: String = "") = server.enqueue(MockResponse.Builder().code(code).body(body).build())
    private fun nextRequest() = server.takeRequest(5, TimeUnit.SECONDS) ?: error("no request")
    private fun awaitState(predicate: (WatchlistRepository.State) -> Boolean) =
        runBlocking { withTimeout(5.seconds) { repo.state.first(predicate) } }

    @Test fun `loads, then toggles optimistically`() {
        respond(200, """{"movies":[{"tmdbId":949,"title":"Heat","year":1995,"posterPath":"/h.jpg","voteAverage":7.9}]}""")
        repo.refresh()
        assertEquals(setOf(949), (awaitState { it is WatchlistRepository.State.Ready } as WatchlistRepository.State.Ready).ids)

        respond(204)
        repo.toggle(arrival)
        val now = repo.state.value as WatchlistRepository.State.Ready
        assertEquals(listOf(329865, 949), now.movies.map { it.tmdbId }) // newest first, before the server answers

        assertEquals("GET", nextRequest().method) // the initial load
        val put = nextRequest()
        assertEquals("PUT", put.method)
        assertEquals("/api/v1/watchlist/329865", put.url.encodedPath)
    }

    @Test fun `resyncs from the server and reports when a toggle fails`() {
        respond(200, """{"movies":[]}""")
        repo.refresh()
        awaitState { it is WatchlistRepository.State.Ready }

        // Undispatched: subscribes right here, before the toggle can emit (errors are dropped with no subscriber).
        val error = scope.async(start = CoroutineStart.UNDISPATCHED) { repo.errors.first() }
        respond(500)
        respond(200, """{"movies":[]}""")
        repo.toggle(heat)
        assertTrue(repo.contains(repo.state.value, 949)) // optimistic

        assertEquals("Couldn't update your watchlist", runBlocking { withTimeout(5.seconds) { error.await() } })
        awaitState { it is WatchlistRepository.State.Ready && 949 !in it.ids } // rolled back by the resync
    }

    @Test fun `reset forgets everything`() {
        respond(200, """{"movies":[{"tmdbId":949,"title":"Heat"}]}""")
        repo.refresh()
        awaitState { it is WatchlistRepository.State.Ready }
        repo.reset()
        assertEquals(WatchlistRepository.State.Loading, repo.state.value)
    }
}
