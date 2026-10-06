package com.kieranaston.movierecs.data

import com.kieranaston.movierecs.FakeDeviceAuth
import com.kieranaston.movierecs.FakeStorage
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.Timeout

@OptIn(ExperimentalCoroutinesApi::class)
class SessionRepositoryTest {
    @get:Rule val timeout: Timeout = Timeout.seconds(20)
    private val dispatcher = StandardTestDispatcher()
    private val scope = TestScope(dispatcher)
    private val auth = FakeDeviceAuth()

    private fun repo(storage: FakeStorage) = SessionRepository(storage, auth, scope, io = dispatcher)

    @Test fun `restores a saved session`() = scope.runTest {
        val r = repo(FakeStorage(StoredSession("tok", "alice@example.com")))
        assertEquals(SessionRepository.State.Loading, r.state.value)
        advanceUntilIdle()
        assertEquals(SessionRepository.State.SignedIn("alice@example.com"), r.state.value)
        assertEquals("tok", r.currentToken())
    }

    @Test fun `starts signed out without one`() = scope.runTest {
        val r = repo(FakeStorage())
        advanceUntilIdle()
        assertEquals(SessionRepository.State.SignedOut, r.state.value)
        assertNull(r.currentToken())
    }

    @Test fun `saves the new session after approval`() = scope.runTest {
        val storage = FakeStorage()
        val r = repo(storage)
        advanceUntilIdle()
        r.completeSignIn("new-token")
        assertEquals(StoredSession("new-token", "alice@example.com"), storage.saved)
        assertEquals(SessionRepository.State.SignedIn("alice@example.com"), r.state.value)
    }

    @Test fun `sign out forgets locally even if the server call fails`() = scope.runTest {
        val storage = FakeStorage(StoredSession("tok", "alice@example.com"))
        val r = repo(storage)
        advanceUntilIdle()
        auth.signOutFailure = RuntimeException("offline")
        r.signOut()
        assertEquals(listOf("tok"), auth.signedOut)
        assertNull(storage.saved)
        assertEquals(SessionRepository.State.SignedOut, r.state.value)
    }

    @Test fun `a rejected token signs out`() = scope.runTest {
        val storage = FakeStorage(StoredSession("tok", "alice@example.com"))
        val r = repo(storage)
        advanceUntilIdle()
        r.onUnauthorized()
        advanceUntilIdle()
        assertNull(storage.saved)
        assertEquals(SessionRepository.State.SignedOut, r.state.value)
    }
}
