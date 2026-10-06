package com.kieranaston.movierecs.ui

import com.kieranaston.movierecs.FakeDeviceAuth
import com.kieranaston.movierecs.FakeStorage
import com.kieranaston.movierecs.MainDispatcherRule
import com.kieranaston.movierecs.code
import com.kieranaston.movierecs.data.PollResult
import com.kieranaston.movierecs.data.SessionRepository
import com.kieranaston.movierecs.ui.signin.SignInViewModel
import com.kieranaston.movierecs.ui.signin.SignInViewModel.UiState
import com.kieranaston.movierecs.ui.signin.formatUserCode
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout

@OptIn(ExperimentalCoroutinesApi::class)
class SignInViewModelTest {
    @get:Rule val timeout: Timeout = Timeout.seconds(20)
    @get:Rule val main = MainDispatcherRule()

    private val auth = FakeDeviceAuth()
    private val storage = FakeStorage()

    private fun TestScope.setUp(): Pair<SignInViewModel, SessionRepository> {
        auth.clock = { currentTime }
        val session = SessionRepository(storage, auth, backgroundScope, io = main.dispatcher)
        return SignInViewModel(auth, session).also { it.start() } to session
    }

    @Test fun `shows the code, polls at the server's interval, and signs in on approval`() = runTest(main.dispatcher) {
        auth.codes += code("WDJBMJHT", interval = 5)
        auth.polls.addAll(listOf(PollResult.Pending, PollResult.Pending, PollResult.Granted("tok")))
        val (vm, session) = setUp()
        runCurrent()
        assertEquals(UiState.ShowCode("WDJBMJHT", "https://example.com/activate", "https://example.com/activate?user_code=WDJBMJHT", false), vm.state)

        advanceUntilIdle()
        assertEquals(listOf(5_000L, 10_000L, 15_000L), auth.pollTimes)
        assertEquals(SessionRepository.State.SignedIn("alice@example.com"), session.state.value)
        assertEquals("tok", storage.saved?.token)
    }

    @Test fun `backs off by five seconds when told to slow down`() = runTest(main.dispatcher) {
        auth.codes += code(interval = 5)
        auth.polls.addAll(listOf(PollResult.SlowDown, PollResult.Pending, PollResult.Granted("tok")))
        setUp()
        advanceUntilIdle()
        assertEquals(listOf(5_000L, 15_000L, 25_000L), auth.pollTimes)
    }

    @Test fun `replaces an expired code`() = runTest(main.dispatcher) {
        auth.codes += code("AAAAAAAA", expiresIn = 10, interval = 5)
        auth.codes += code("BBBBBBBB")
        val (vm, _) = setUp()
        advanceTimeBy(10_001)
        runCurrent()
        assertEquals("BBBBBBBB", (vm.state as UiState.ShowCode).userCode)
        assertEquals(false, (vm.state as UiState.ShowCode).afterDenial)
    }

    @Test fun `after a denial shows a fresh code with a note`() = runTest(main.dispatcher) {
        auth.codes += code("AAAAAAAA"); auth.codes += code("BBBBBBBB")
        auth.polls += PollResult.Denied
        val (vm, _) = setUp()
        advanceTimeBy(5_001)
        runCurrent()
        val state = vm.state as UiState.ShowCode
        assertEquals("BBBBBBBB", state.userCode)
        assertTrue(state.afterDenial)
    }

    @Test fun `keeps polling through network errors`() = runTest(main.dispatcher) {
        auth.codes += code()
        auth.polls.addAll(listOf(RuntimeException("offline"), PollResult.Granted("tok")))
        val (_, session) = setUp()
        advanceUntilIdle()
        assertEquals(SessionRepository.State.SignedIn("alice@example.com"), session.state.value)
    }

    @Test fun `fails visibly if no code can be fetched, and retries`() = runTest(main.dispatcher) {
        auth.codeFailure = RuntimeException("offline")
        val (vm, _) = setUp()
        runCurrent()
        assertEquals(UiState.Failed, vm.state)

        auth.codeFailure = null
        auth.codes += code("CCCCCCCC")
        vm.retry()
        runCurrent()
        assertEquals("CCCCCCCC", (vm.state as UiState.ShowCode).userCode)
    }

    @Test fun `formats codes like the website`() {
        assertEquals("WDJB-MJHT", formatUserCode("WDJBMJHT"))
        assertEquals("ABC", formatUserCode("ABC"))
    }
}
