package com.kieranaston.movierecs

import com.kieranaston.movierecs.data.DeviceAuth
import com.kieranaston.movierecs.data.DeviceCode
import com.kieranaston.movierecs.data.Me
import com.kieranaston.movierecs.data.PollResult
import com.kieranaston.movierecs.data.StoredSession
import com.kieranaston.movierecs.data.TokenStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestWatcher
import org.junit.runner.Description

/** Runs `Dispatchers.Main` (and so `viewModelScope`) on a test dispatcher with virtual time. */
@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(val dispatcher: TestDispatcher = StandardTestDispatcher()) : TestWatcher() {
    override fun starting(description: Description) = Dispatchers.setMain(dispatcher)
    override fun finished(description: Description) = Dispatchers.resetMain()
}

class FakeStorage(var saved: StoredSession? = null) : TokenStorage {
    override fun read() = saved
    override fun write(session: StoredSession) { saved = session }
    override fun clear() { saved = null }
}

/** Scriptable stand-in for the server's device-flow endpoints. */
class FakeDeviceAuth : DeviceAuth {
    val codes = ArrayDeque<DeviceCode>()
    val polls = ArrayDeque<Any>() // PollResult or Throwable
    var codeFailure: Throwable? = null
    var signedOut = mutableListOf<String>()
    var signOutFailure: Throwable? = null
    val pollTimes = mutableListOf<Long>()
    var clock: () -> Long = { 0 }

    override suspend fun requestCode(): DeviceCode = codeFailure?.let { throw it } ?: codes.removeFirst()
    override suspend fun poll(deviceCode: String): PollResult {
        pollTimes += clock()
        return when (val next = polls.removeFirstOrNull() ?: PollResult.Pending) {
            is Throwable -> throw next
            else -> next as PollResult
        }
    }
    override suspend fun me(token: String) = Me(email = "alice@example.com", name = "Alice")
    override suspend fun signOut(token: String) {
        signedOut += token
        signOutFailure?.let { throw it }
    }
}

fun code(user: String = "WDJBMJHT", expiresIn: Int = 600, interval: Int = 5) = DeviceCode(
    deviceCode = "device-$user", userCode = user,
    verificationUri = "https://example.com/activate",
    verificationUriComplete = "https://example.com/activate?user_code=$user",
    expiresIn = expiresIn, interval = interval,
)
