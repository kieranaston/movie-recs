package com.kieranaston.movierecs.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Typography
import androidx.tv.material3.darkColorScheme
import com.kieranaston.movierecs.R

/*
 * Design tokens — the one place to restyle the app.
 * Change a value here, then `./gradlew installDebug` (or use the previews in Android Studio).
 */

/** Colours. */
object Palette {
    val Accent = Color(0xFFE11D2E)          // brand red: app title, primary buttons
    val Background = Color(0xFF0A0A0A)      // screen background
    val Surface = Color(0xFF161616)         // tiles, search box
    val SurfaceVariant = Color(0xFF262626)  // loading placeholders
    val Text = Color(0xFFEDEDED)
    val TextMuted = Color(0xFFA3A3A3)       // metadata, captions
    val FocusBorder = Color.White           // outline on the focused poster
}

/** Sizes and spacing. 1 dp ≈ 2 px on a 1080p TV (the screen is 960 × 540 dp). */
object Dimens {
    val Gutter = 48.dp           // left/right margin, keeps content inside TV-safe area
    val TopInset = 24.dp         // space above the tab bar / page title
    val PosterWidth = 140.dp     // poster cards in rows and grids
    val PosterGap = 20.dp        // horizontal gap between posters
    val RowGap = 16.dp           // vertical gap between rows on Home / genre pages
    val GridRowGap = 28.dp       // vertical gap between grid rows
    val CornerRadius = 8.dp      // poster corners
    val TileHeight = 88.dp       // genre tiles
    val FocusBorderWidth = 3.dp
    val FocusGlow = 16.dp        // shadow under the focused poster
}

/** Focus feedback. */
object Motion {
    const val PosterFocusScale = 1.08f
    const val TileFocusScale = 1.05f
    const val ScreenFadeMillis = 200
    const val FocusFadeMillis = 200   // title colour fade when a poster gains/loses focus
}

/**
 * Fonts. The app bundles Inter (res/font, SIL Open Font License) in four weights.
 * To try another typeface, add its .ttf files to res/font and point [Family] at them,
 * or use a system one: FontFamily.SansSerif / Serif / Monospace.
 */
object Fonts {
    val Family = FontFamily(
        Font(R.font.inter_regular, FontWeight.Normal),
        Font(R.font.inter_medium, FontWeight.Medium),
        Font(R.font.inter_semibold, FontWeight.SemiBold),
        Font(R.font.inter_bold, FontWeight.Bold),
    )

    private fun style(size: Int, weight: FontWeight, line: Int, tracking: Double = 0.0) = TextStyle(
        fontFamily = Family, fontSize = size.sp, fontWeight = weight, lineHeight = line.sp, letterSpacing = tracking.sp,
    )

    val Typography = Typography(
        displaySmall = style(40, FontWeight.Bold, 46, -0.5),        // movie title on the details screen
        headlineMedium = style(30, FontWeight.SemiBold, 36, -0.25), // genre page title
        titleLarge = style(20, FontWeight.SemiBold, 26),            // row titles ("Top Rated"), app name
        titleMedium = style(16, FontWeight.SemiBold, 22),           // genre tiles, search box, empty-state titles
        titleSmall = style(15, FontWeight.Medium, 21),              // tagline on details
        bodyLarge = style(17, FontWeight.Normal, 26),               // overview on details
        bodyMedium = style(14, FontWeight.Normal, 20),              // About text, hints
        labelLarge = style(14, FontWeight.Medium, 18),              // poster titles, tabs, buttons
        labelMedium = style(12, FontWeight.Medium, 16, 0.2),        // year · rating, genres
        labelSmall = style(11, FontWeight.Medium, 14, 0.2),         // small captions
    )
}

private val Colors = darkColorScheme(
    primary = Palette.Accent,
    onPrimary = Color.White,
    background = Palette.Background,
    onBackground = Palette.Text,
    surface = Palette.Surface,
    onSurface = Palette.Text,
    surfaceVariant = Palette.SurfaceVariant,
    onSurfaceVariant = Palette.TextMuted,
    border = Palette.FocusBorder,
)

@Composable
fun MovieTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, typography = Fonts.Typography, content = content)
}
