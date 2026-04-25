# ClusterLab — PCA + K-Means + DBSCAN Dashboard

A fully client-side clustering analysis dashboard built with vanilla JavaScript, Chart.js, and PapaParse. No server, no dependencies to install — just open `index.html` in a browser.

---

## Features

| Feature | Description |
|---|---|
| **CSV Upload** | Drag & drop or click to upload any CSV file |
| **Demo Dataset** | Built-in Iris dataset (150 rows, 4 features) for instant testing |
| **PCA** | Principal Component Analysis — projects data to 2D, shows explained variance % per axis |
| **K-Means Clustering** | Lloyd's algorithm with K-Means++ initialization, configurable K |
| **Elbow Method** | Inertia vs K chart to find optimal number of clusters (auto-suggests best K) |
| **DBSCAN** | Density-Based Spatial Clustering — finds arbitrary-shape clusters and labels noise |
| **Feature Distributions** | Histogram for each numeric feature with column switcher tabs |
| **Correlation Heatmap** | Pearson correlation matrix rendered as a color-coded heatmap |
| **Enriched Data Table** | Searchable table with K-Means and DBSCAN cluster assignments per row |
| **Metrics Strip** | Summary metrics: inertia, cluster count, noise points, PCA variance, suggested K |

---

## Getting Started

```bash
# No build step needed — just open in a browser
open index.html

# Or serve locally with any static server:
npx serve .
python -m http.server 8080
```

Then open `http://localhost:8080`.

---

## Controls

| Slider | Description |
|---|---|
| **K-Means clusters (K)** | Number of clusters for K-Means (2–10) |
| **DBSCAN ε (epsilon)** | Neighborhood radius for DBSCAN (scale: value/10) |
| **DBSCAN minPts** | Minimum points to form a dense region |
| **Max K (elbow search)** | Upper bound for the Elbow Method scan |

Click **Run Analysis** to re-run all algorithms with the current settings.

---

## CSV Format

- First row must be column headers
- Numeric columns are auto-detected and used for all analysis
- Non-numeric columns (e.g. labels) appear in the table but are excluded from computation
- Supported separators: `,` `;` `\t` `|` (auto-detected)
- Max recommended: ~5000 rows (DBSCAN is O(n²) for larger sets)

**Example:**

```csv
sepal_length,sepal_width,petal_length,petal_width,label
5.1,3.5,1.4,0.2,setosa
6.3,3.3,4.7,1.6,versicolor
```

---

## Algorithms

### PCA (Principal Component Analysis)
Implemented via **power iteration** on the covariance matrix. The top 2 eigenvectors are extracted using iterative deflation. Data is **standardized** (zero mean, unit variance) before projection.

### K-Means
Lloyd's algorithm with **K-Means++ initialization** for better convergence. Runs until cluster assignment stabilizes or `maxIter=100` is reached.

### Elbow Method
Runs K-Means for K = 1 to `maxK` and records inertia (within-cluster sum of squared distances). The optimal K is estimated using the **Ramer-Douglas-Peucker perpendicular distance** heuristic on the inertia curve.

### DBSCAN
Standard DBSCAN with **Euclidean distance** in PCA space:
- Points with `≥ minPts` neighbors within radius `ε` are **core points**
- Points reachable from a core point are **border points**
- All remaining points are labeled **noise (-1)**

---

## Project Structure

```
pca_dashboard/
├── index.html      — App shell, layout, chart canvases
├── style.css       — Dark industrial theme, responsive grid
├── script.js       — All algorithms + chart rendering logic
└── README.md       — This file
```

---

## Tech Stack

- **Chart.js 4.4** — scatter, line, bar charts
- **PapaParse 5.4** — robust CSV parsing (handles quotes, mixed separators)
- **Google Fonts** — Syne (display) + Space Mono (monospace)
- Zero backend, zero build tools

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled. Large datasets (>2000 rows) may be slow due to DBSCAN's O(n²) complexity.

---

## License

MIT — free to use and modify.
