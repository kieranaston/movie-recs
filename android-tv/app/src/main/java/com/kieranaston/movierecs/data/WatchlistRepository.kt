package com.kieranaston.movierecs.data

import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * The one place the app keeps watchlist state, so every screen agrees.
 * Toggles are optimistic; on failure we resync from the server and report an error.
 */
class WatchlistRepository(private val api: Api, private val scope: CoroutineScope) {
    sealed interface State {
        data object Loading : State
        data object Failed : State
        data class Ready(val movies: List<Movie>) : State {
            val ids: Set<Int> = movies.mapTo(HashSet()) { it.tmdbId }
        }
    }

    private val _state = MutableStateFlow<State>(State.Loading)
    val state: StateFlow<State> = _state.asStateFlow()

    private val _errors = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val errors: SharedFlow<String> = _errors

    private val writes = Mutex() // keep requests in the order the user pressed

    fun refresh() {
        scope.launch {
            if (_state.value !is State.Ready) _state.value = State.Loading
            try {
                _state.value = State.Ready(api.watchlist())
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                if (_state.value !is State.Ready) _state.value = State.Failed // keep showing what we have
            }
        }
    }

    /** Forget everything (signed out). */
    fun reset() {
        _state.value = State.Loading
    }

    fun contains(state: State, tmdbId: Int) = state is State.Ready && tmdbId in state.ids

    fun toggle(movie: Movie) {
        val current = _state.value as? State.Ready ?: run {
            _errors.tryEmit("Watchlist is still loading")
            refresh()
            return
        }
        val add = movie.tmdbId !in current.ids
        _state.update { s ->
            if (s !is State.Ready) s
            else State.Ready(if (add) listOf(movie) + s.movies else s.movies.filter { it.tmdbId != movie.tmdbId })
        }
        scope.launch {
            writes.withLock {
                try {
                    if (add) api.addToWatchlist(movie.tmdbId) else api.removeFromWatchlist(movie.tmdbId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    _errors.tryEmit("Couldn't update your watchlist")
                    refresh() // resync with the server instead of guessing the rollback
                }
            }
        }
    }
}
