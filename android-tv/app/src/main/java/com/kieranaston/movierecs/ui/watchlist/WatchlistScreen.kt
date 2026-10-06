package com.kieranaston.movierecs.ui.watchlist

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.data.WatchlistRepository.State
import com.kieranaston.movierecs.ui.components.EmptyState
import com.kieranaston.movierecs.ui.components.ErrorState
import com.kieranaston.movierecs.ui.components.FocusMemory
import com.kieranaston.movierecs.ui.components.MovieGrid
import com.kieranaston.movierecs.ui.components.RowsPlaceholder
import com.kieranaston.movierecs.ui.components.app

@Composable
fun WatchlistScreen(memory: FocusMemory, onOpen: (Movie) -> Unit) {
    val repo = app().watchlist
    val state by repo.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { repo.refresh() } // pick up changes made on the website

    when (val s = state) {
        State.Loading -> RowsPlaceholder()
        State.Failed -> ErrorState(onRetry = repo::refresh)
        is State.Ready ->
            if (s.movies.isEmpty()) EmptyState("Your watchlist is empty", "Open any movie and choose Add to Watchlist.")
            else MovieGrid(s.movies, onOpen, "watchlist", memory, Modifier.fillMaxSize())
    }
}
