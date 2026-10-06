package com.kieranaston.movierecs.ui.signin

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kieranaston.movierecs.data.DeviceAuth
import com.kieranaston.movierecs.data.DeviceCode
import com.kieranaston.movierecs.data.PollResult
import com.kieranaston.movierecs.data.SessionRepository
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Drives the TV side of sign-in: get a code, show it, poll politely until the user approves on
 * their phone. Expired codes are replaced automatically; a denial shows a fresh code with a note.
 */
class SignInViewModel(private val auth: DeviceAuth, private val session: SessionRepository) : ViewModel() {
    sealed interface UiState {
        data object Loading : UiState
        data class ShowCode(val userCode: String, val verificationUri: String, val qrUrl: String, val afterDenial: Boolean) : UiState
        data object Failed : UiState
    }

    var state by mutableStateOf<UiState>(UiState.Loading)
        private set

    private var job: Job? = null

    /** Starts (or restarts) the flow unless it's already running. */
    fun start() {
        if (job?.isActive == true) return
        job = viewModelScope.launch { run() }
    }

    fun retry() {
        job?.cancel()
        state = UiState.Loading
        start()
    }

    private suspend fun run() {
        var afterDenial = false
        while (true) {
            val code = try {
                auth.requestCode()
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                state = UiState.Failed
                return
            }
            state = UiState.ShowCode(code.userCode, code.verificationUri, code.verificationUriComplete, afterDenial)

            when (val outcome = waitForApproval(code)) {
                is PollResult.Granted -> {
                    try {
                        session.completeSignIn(outcome.token)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                        state = UiState.Failed
                    }
                    return
                }
                PollResult.Denied -> afterDenial = true
                else -> afterDenial = false // expired: show a fresh code
            }
        }
    }

    /** Polls at the server's interval (backing off on slow_down) until a final answer or expiry. */
    private suspend fun waitForApproval(code: DeviceCode): PollResult {
        var interval = code.interval.coerceAtLeast(1)
        var remaining = code.expiresIn
        while (remaining > 0) {
            delay(interval * 1000L)
            remaining -= interval
            val result = try {
                auth.poll(code.deviceCode)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                continue // network blip: keep trying until the code expires
            }
            when (result) {
                PollResult.Pending -> Unit
                PollResult.SlowDown -> interval += 5
                else -> return result
            }
        }
        return PollResult.Expired
    }
}
