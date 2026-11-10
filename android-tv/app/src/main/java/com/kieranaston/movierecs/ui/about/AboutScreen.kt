package com.kieranaston.movierecs.ui.about

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.kieranaston.movierecs.BuildConfig
import com.kieranaston.movierecs.R
import com.kieranaston.movierecs.ui.theme.Dimens

/** Attribution required by the TMDB API terms (and IMDb for the ratings). */
@Composable
fun AboutScreen() {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Column(Modifier.padding(start = Dimens.Gutter, top = 32.dp).width(640.dp)) {
        Image(painterResource(R.drawable.tmdb_logo), contentDescription = "The Movie Database (TMDB)", modifier = Modifier.height(28.dp))
        Spacer(Modifier.height(24.dp))
        Text(
            "This product uses the TMDB API but is not endorsed or certified by TMDB.",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(Modifier.height(8.dp))
        Text("Movie data and images are provided by The Movie Database (themoviedb.org).", style = MaterialTheme.typography.bodyMedium, color = muted)
        Spacer(Modifier.height(8.dp))
        Text("Ratings information courtesy of IMDb (imdb.com). Used with permission.", style = MaterialTheme.typography.bodyMedium, color = muted)
        Spacer(Modifier.height(8.dp))
        Text("Inter typeface © The Inter Project Authors, SIL Open Font License 1.1.", style = MaterialTheme.typography.bodyMedium, color = muted)
        Spacer(Modifier.height(40.dp))
        Text("Movie Recs ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.labelMedium, color = muted)
    }
}
