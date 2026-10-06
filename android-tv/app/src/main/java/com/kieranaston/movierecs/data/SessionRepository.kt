package com.kieranaston.movierecs.data

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Who the TV is signed in as. The token stays inside this class and the storage. */
class SessionRepository(
    private val storage: TokenStorage,
    private val auth: DeviceAuth,
    private val scope: CoroutineScope,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    sealed interface State {
        data object Loading : State
        data object SignedOut : State
        data class SignedIn(val email: String) : State
    }

    private val _state = MutableStateFlow<State>(State.Loading)
    val state: StateFlow<State> = _state.asStateFlow()

    @Volatile
    private var token: String? = null

    init {
        scope.launch {
            val saved = withContext(io) { storage.read() }
            token = saved?.token
            _state.value = saved?.let { State.SignedIn(it.email) } ?: State.SignedOut
        }
    }

    /** Bearer token for API calls, if signed in. */
    fun currentToken(): String? = token

    /** Called by the sign-in flow once the user approved this TV. */
    suspend fun completeSignIn(newToken: String) {
        val me = auth.me(newToken)
        withContext(io) { storage.write(StoredSession(newToken, me.email)) }
        token = newToken
        _state.value = State.SignedIn(me.email)
    }

    /** User chose "Sign out": revoke the session on the server (best effort), then forget it. */
    suspend fun signOut() {
        val old = token
        clearLocal()
        if (old != null) runCatching { auth.signOut(old) }
    }

    /** The server rejected our token (revoked from the website, expired, or user removed). */
    fun onUnauthorized() {
        if (token != null) scope.launch { clearLocal() }
    }

    private suspend fun clearLocal() {
        token = null
        withContext(io) { storage.clear() }
        _state.value = State.SignedOut
    }
}
