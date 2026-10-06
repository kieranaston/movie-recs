package com.kieranaston.movierecs.ui.browse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.ui.components.EmptyState
import com.kieranaston.movierecs.ui.components.ErrorState
import com.kieranaston.movierecs.ui.components.FocusMemory
import com.kieranaston.movierecs.ui.components.Load
import com.kieranaston.movierecs.ui.components.MovieGrid
import com.kieranaston.movierecs.ui.components.MovieRow
import com.kieranaston.movierecs.ui.components.RowsPlaceholder
import com.kieranaston.movierecs.ui.theme.Dimens

/**
 * Rows of sections, or a grid when a filter is active.
 * If [focusFirst], the first poster takes focus once loaded.
 */
@Composable
fun BrowseContent(
    vm: BrowseViewModel,
    memory: FocusMemory,
    prefix: String,
    onOpen: (Movie) -> Unit,
    focusFirst: Boolean = false,
) {
    when (val c = vm.content) {
        Load.Loading -> RowsPlaceholder()
        Load.Failed -> ErrorState(onRetry = vm::load)
        is Load.Ready -> {
            var focused by rememberSaveable(prefix, vm.filter) { mutableStateOf(!focusFirst) }
            val first = when (val v = c.value) {
                is BrowseViewModel.Content.Rows -> v.rows.firstOrNull()?.let { r -> r.movies.firstOrNull()?.let { "$prefix:${r.id}:${it.tmdbId}" } }
                is BrowseViewModel.Content.Grid -> v.movies.firstOrNull()?.let { "$prefix:grid:${it.tmdbId}" }
            }
            LaunchedEffect(first) { if (!focused && first != null) { memory.focus(first); focused = true } }

            when (val v = c.value) {
                is BrowseViewModel.Content.Rows ->
                    if (v.rows.isEmpty()) EmptyState("Nothing here yet")
                    else LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 48.dp),
                        verticalArrangement = Arrangement.spacedBy(Dimens.RowGap),
                    ) {
                        items(v.rows, key = { it.id }) { row ->
                            MovieRow(row.label, row.movies, onOpen, "$prefix:${row.id}", memory, onNearEnd = { vm.loadMoreRow(row.id) })
                        }
                    }

                is BrowseViewModel.Content.Grid ->
                    MovieGrid(
                        movies = v.movies,
                        onOpen = onOpen,
                        focusPrefix = "$prefix:grid",
                        memory = memory,
                        modifier = Modifier.fillMaxSize(),
                        onNearEnd = vm::loadMoreGrid,
                    )
            }
        }
    }
}
