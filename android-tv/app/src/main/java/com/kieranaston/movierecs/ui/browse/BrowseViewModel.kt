package com.kieranaston.movierecs.ui.browse

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kieranaston.movierecs.data.Api
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.data.Section
import com.kieranaston.movierecs.ui.components.Load
import com.kieranaston.movierecs.ui.components.load
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** Home (genre = null) or one genre page, optionally narrowed by a filter. */
class BrowseViewModel(private val api: Api, private val genre: String?) : ViewModel() {
    sealed interface Content {
        data class Rows(val rows: List<Section>) : Content
        data class Grid(val movies: List<Movie>, val total: Int) : Content
    }

    var filter by mutableStateOf<String?>(null)
        private set
    var content by mutableStateOf<Load<Content>>(Load.Loading)
        private set

    private var loadJob: Job? = null
    private val pending = mutableSetOf<String>()

    init { load() }

    fun selectFilter(value: String?) {
        if (value == filter) return
        filter = value
        load()
    }

    fun load() {
        loadJob?.cancel()
        pending.clear()
        content = Load.Loading
        loadJob = viewModelScope.launch {
            content = load {
                val r = api.browse(genre, filter)
                if (r.mode == "list") Content.Grid(r.movies, r.total) else Content.Rows(r.sections)
            }
        }
    }

    /** Next page of one row, when focus nears its end. */
    fun loadMoreRow(id: String) {
        val row = (rows() ?: return).find { it.id == id } ?: return
        if (row.movies.size >= row.total || !pending.add(id)) return
        viewModelScope.launch {
            try {
                val page = api.section(id, genre, offset = row.movies.size)
                val current = rows() ?: return@launch
                content = Load.Ready(Content.Rows(current.map {
                    if (it.id == id) it.copy(movies = (it.movies + page.movies).distinctBy(Movie::tmdbId), total = page.total) else it
                }))
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                // Leave the row as is; scrolling back will retry.
            } finally {
                pending.remove(id)
            }
        }
    }

    /** Next page of the filtered grid. */
    fun loadMoreGrid() {
        val grid = (content as? Load.Ready)?.value as? Content.Grid ?: return
        if (grid.movies.size >= grid.total || !pending.add(GRID)) return
        val forFilter = filter
        viewModelScope.launch {
            try {
                val r = api.browse(genre, forFilter, offset = grid.movies.size, limit = 40)
                val current = (content as? Load.Ready)?.value as? Content.Grid ?: return@launch
                if (forFilter != filter) return@launch
                content = Load.Ready(current.copy(movies = (current.movies + r.movies).distinctBy(Movie::tmdbId)))
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                // Leave the grid as is; scrolling back will retry.
            } finally {
                pending.remove(GRID)
            }
        }
    }

    private fun rows() = ((content as? Load.Ready)?.value as? Content.Rows)?.rows

    private companion object { const val GRID = "\u0000grid" }
}
