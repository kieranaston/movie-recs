package com.kieranaston.movierecs.ui.search

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.kieranaston.movierecs.data.Api
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.ui.components.AppIcons
import com.kieranaston.movierecs.ui.components.EmptyState
import com.kieranaston.movierecs.ui.components.ErrorState
import com.kieranaston.movierecs.ui.components.FocusMemory
import com.kieranaston.movierecs.ui.components.Load
import com.kieranaston.movierecs.ui.components.MovieGrid
import com.kieranaston.movierecs.ui.components.app
import com.kieranaston.movierecs.ui.components.load
import com.kieranaston.movierecs.ui.theme.Dimens
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

class SearchViewModel(private val api: Api) : ViewModel() {
    private val _query = MutableStateFlow("")
    val query = _query.asStateFlow()

    /** null = nothing typed yet. */
    var results by mutableStateOf<Load<List<Movie>>?>(null)
        private set
    private var page = 1
    private var totalPages = 0
    private var loadingMore = false

    init {
        @OptIn(FlowPreview::class)
        viewModelScope.launch {
            _query.debounce(350).map { it.trim() }.distinctUntilChanged().collectLatest { search(it) }
        }
    }

    fun setQuery(q: String) { _query.value = q }

    fun retry() = viewModelScope.launch { search(_query.value.trim()) }

    private suspend fun search(q: String) {
        if (q.isEmpty()) { results = null; return }
        results = Load.Loading
        results = load {
            val r = api.search(q)
            page = r.page
            totalPages = r.totalPages
            r.movies
        }
    }

    fun loadMore() {
        val current = (results as? Load.Ready)?.value ?: return
        if (loadingMore || page >= totalPages) return
        loadingMore = true
        val q = _query.value.trim()
        viewModelScope.launch {
            try {
                val r = api.search(q, page + 1)
                if (q == _query.value.trim()) {
                    page = r.page
                    results = Load.Ready((current + r.movies).distinctBy(Movie::tmdbId))
                }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                // Keep current results; reaching the end again retries.
            } finally {
                loadingMore = false
            }
        }
    }
}

@Composable
fun SearchScreen(memory: FocusMemory, onOpen: (Movie) -> Unit) {
    val api = app().api
    val vm = viewModel { SearchViewModel(api) }
    val query by vm.query.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    var fieldFocused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(28.dp)

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .padding(horizontal = Dimens.Gutter, vertical = 12.dp)
                .width(560.dp)
                .background(MaterialTheme.colorScheme.surface, shape)
                .border(BorderStroke(2.dp, if (fieldFocused) Color.White else Color.Transparent), shape)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(AppIcons.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp))
            BasicTextField(
                value = query,
                onValueChange = vm::setQuery,
                singleLine = true,
                textStyle = MaterialTheme.typography.titleMedium.copy(color = Color.White),
                cursorBrush = SolidColor(Color.White),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = {
                    keyboard?.hide()
                    focusManager.moveFocus(FocusDirection.Down)
                }),
                modifier = Modifier
                    .padding(start = 12.dp)
                    .fillMaxWidth()
                    .onFocusChanged { fieldFocused = it.isFocused },
                decorationBox = { inner ->
                    if (query.isEmpty()) {
                        Text("Search movies", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    inner()
                },
            )
        }

        when (val r = vm.results) {
            null -> EmptyState("Find a movie", "Select the search box and type a title.")
            Load.Loading -> EmptyState("Searching…")
            Load.Failed -> ErrorState(onRetry = { vm.retry() })
            is Load.Ready ->
                if (r.value.isEmpty()) EmptyState("No results", "Nothing matched “${query.trim()}”.")
                else MovieGrid(r.value, onOpen, "search", memory, Modifier.fillMaxSize(), onNearEnd = vm::loadMore)
        }
    }
}
