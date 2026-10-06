package com.kieranaston.movierecs.ui.genres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.FilterChip
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.kieranaston.movierecs.data.Movie
import com.kieranaston.movierecs.ui.browse.BrowseContent
import com.kieranaston.movierecs.ui.browse.BrowseViewModel
import com.kieranaston.movierecs.ui.components.app
import com.kieranaston.movierecs.ui.components.rememberFocusMemory
import com.kieranaston.movierecs.ui.theme.Dimens

/** One genre: its title, optional filter chips, then section rows (or a grid when filtered). */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun GenreScreen(slug: String, name: String, filters: List<String>, onOpen: (Movie) -> Unit) {
    val api = app().api
    val vm = viewModel(key = "genre:$slug") { BrowseViewModel(api, slug) }
    val memory = rememberFocusMemory()

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.padding(start = Dimens.Gutter, end = Dimens.Gutter, top = Dimens.TopInset, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(name, style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(end = 20.dp))
            if (filters.isNotEmpty()) {
                FilterChip(selected = vm.filter == null, onClick = { vm.selectFilter(null) }) { Text("All") }
                filters.forEach { f ->
                    FilterChip(selected = vm.filter == f, onClick = { vm.selectFilter(f) }) { Text(f) }
                }
            }
        }
        BrowseContent(vm, memory, prefix = "genre:$slug", onOpen = onOpen, focusFirst = true)
    }
}
