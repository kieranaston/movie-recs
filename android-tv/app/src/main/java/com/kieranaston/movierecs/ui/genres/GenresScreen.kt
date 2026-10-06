package com.kieranaston.movierecs.ui.genres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.kieranaston.movierecs.data.Api
import com.kieranaston.movierecs.data.Genre
import com.kieranaston.movierecs.ui.components.ErrorState
import com.kieranaston.movierecs.ui.components.FocusMemory
import com.kieranaston.movierecs.ui.components.Load
import com.kieranaston.movierecs.ui.components.Placeholder
import com.kieranaston.movierecs.ui.components.app
import com.kieranaston.movierecs.ui.components.load
import com.kieranaston.movierecs.ui.components.restoreFocus
import com.kieranaston.movierecs.ui.theme.Dimens
import com.kieranaston.movierecs.ui.theme.Motion
import kotlinx.coroutines.launch

class GenresViewModel(private val api: Api) : ViewModel() {
    var genres by mutableStateOf<Load<List<Genre>>>(Load.Loading)
        private set

    init { load() }

    fun load() {
        genres = Load.Loading
        viewModelScope.launch { genres = load { api.genres().genres } }
    }
}

@Composable
fun GenresScreen(memory: FocusMemory, onOpen: (Genre) -> Unit) {
    val api = app().api
    val vm = viewModel { GenresViewModel(api) }

    when (val g = vm.genres) {
        Load.Failed -> ErrorState(onRetry = vm::load)
        else -> LazyVerticalGrid(
            columns = GridCells.Fixed(4),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = Dimens.Gutter, end = Dimens.Gutter, top = 16.dp, bottom = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(Dimens.PosterGap),
            verticalArrangement = Arrangement.spacedBy(Dimens.PosterGap),
        ) {
            if (g is Load.Ready) {
                items(g.value, key = { it.slug }) { genre ->
                    val key = "genre:${genre.slug}"
                    GenreTile(
                        name = genre.name,
                        onClick = { memory.save(key); onOpen(genre) },
                        modifier = Modifier.restoreFocus(memory, key),
                    )
                }
            } else {
                items(16) { Placeholder(Modifier.fillMaxWidth().height(Dimens.TileHeight)) }
            }
        }
    }
}

@Composable
fun GenreTile(name: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(Dimens.TileHeight),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(12.dp)),
        scale = ClickableSurfaceDefaults.scale(focusedScale = Motion.TileFocusScale),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = MaterialTheme.colorScheme.surface,
            focusedContainerColor = Color.White,
            contentColor = MaterialTheme.colorScheme.onSurface,
            focusedContentColor = Color.Black,
        ),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(name, style = MaterialTheme.typography.titleMedium)
        }
    }
}
