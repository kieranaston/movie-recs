package com.kieranaston.movierecs.ui

import android.widget.Toast
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.kieranaston.movierecs.ui.components.app
import com.kieranaston.movierecs.ui.details.DetailsScreen
import com.kieranaston.movierecs.ui.genres.GenreScreen
import com.kieranaston.movierecs.ui.theme.Motion
import kotlinx.serialization.Serializable

@Serializable private object MainRoute
@Serializable private data class GenreRoute(val slug: String, val name: String, val filters: List<String>)
@Serializable private data class DetailsRoute(val tmdbId: Int)

/** The app: a single profile, so it opens straight onto the tabs. */
@Composable
fun AppNavigation() {
    val nav = rememberNavController()
    val context = LocalContext.current
    val watchlist = app().watchlist

    LaunchedEffect(Unit) {
        watchlist.errors.collect { Toast.makeText(context, it, Toast.LENGTH_SHORT).show() }
    }

    NavHost(
        navController = nav,
        startDestination = MainRoute,
        modifier = Modifier.fillMaxSize(),
        enterTransition = { fadeIn(tween(Motion.ScreenFadeMillis)) },
        exitTransition = { fadeOut(tween(Motion.ScreenFadeMillis)) },
    ) {
        composable<MainRoute> {
            MainScreen(
                onOpenMovie = { nav.navigate(DetailsRoute(it.tmdbId)) },
                onOpenGenre = { nav.navigate(GenreRoute(it.slug, it.name, it.filters)) },
            )
        }
        composable<GenreRoute> {
            val r = it.toRoute<GenreRoute>()
            GenreScreen(r.slug, r.name, r.filters, onOpen = { m -> nav.navigate(DetailsRoute(m.tmdbId)) })
        }
        composable<DetailsRoute> {
            DetailsScreen(it.toRoute<DetailsRoute>().tmdbId)
        }
    }
}
