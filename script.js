/* ===================================================================
   ClusterLab — script.js
   Real implementations of: PCA, K-Means, DBSCAN, Elbow Method
   + Feature distributions, Correlation heatmap, Data table
=================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* ── DOM refs ─────────────────────────────────────────────── */
    const fileInput     = document.getElementById('fileInput');
    const uploadButton  = document.getElementById('uploadButton');
    const dropZone      = document.getElementById('dropZone');
    const runButton     = document.getElementById('runButton');
    const tableSearch   = document.getElementById('tableSearch');

    const kSlider       = document.getElementById('kSlider');
    const epsSlider     = document.getElementById('epsSlider');
    const minPtsSlider  = document.getElementById('minPtsSlider');
    const maxKSlider    = document.getElementById('maxKSlider');

    const kVal      = document.getElementById('kVal');
    const epsVal    = document.getElementById('epsVal');
    const minPtsVal = document.getElementById('minPtsVal');
    const maxKVal   = document.getElementById('maxKVal');

    /* ── State ────────────────────────────────────────────────── */
    let parsedData = { headers: [], rows: [] };
    let pcaResult  = null;    // { projected, eigenvectors, varRatio }
    let kmeansResult = null;
    let dbscanResult = null;
    let charts = {};
    let activeFeatureIdx = 0;
    let fullRows = [];        // rows enriched with cluster labels

    const CLUSTER_COLORS = [
        '#00e5ff','#ff3d71','#a259ff','#00ff9d','#ffb830',
        '#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7'
    ];

    /* ── Slider display ───────────────────────────────────────── */
    kSlider.addEventListener('input',      () => { kVal.textContent = kSlider.value; });
    maxKSlider.addEventListener('input',   () => { maxKVal.textContent = maxKSlider.value; });
    minPtsSlider.addEventListener('input', () => { minPtsVal.textContent = minPtsSlider.value; });
    epsSlider.addEventListener('input',    () => {
        epsVal.textContent = (epsSlider.value / 10).toFixed(1);
    });

    /* ── Drop zone ────────────────────────────────────────────── */
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) loadFile(file);
    });

    uploadButton.addEventListener('click', e => {
        e.stopPropagation();
        if (!fileInput.files[0]) { fileInput.click(); return; }
        loadFile(fileInput.files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) loadFile(fileInput.files[0]);
    });


    runButton.addEventListener('click', runAnalysis);

    /* ── Load & parse ─────────────────────────────────────────── */
    function loadFile(file) {
        if (!file.name.endsWith('.csv')) { alert('Please upload a .csv file.'); return; }
        setStatus(`Reading ${file.name}…`);
        const reader = new FileReader();
        reader.onload = e => processCSV(e.target.result, file.name);
        reader.readAsText(file);
    }

    function processCSV(csvText, name = 'file.csv') {
        Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: results => {
                parsedData = { headers: results.meta.fields || [], rows: results.data || [] };
                afterDataLoad(name);
            },
            error: err => { alert('CSV parse error: ' + err.message); }
        });
    }

    function afterDataLoad(name) {
        const numericCols = getNumericCols(parsedData);
        setStatus(`Loaded: ${name}`);
        show('status-bar');
        document.getElementById('tag-rows').textContent   = `${parsedData.rows.length} rows`;
        document.getElementById('tag-cols').textContent   = `${parsedData.headers.length} cols`;
        document.getElementById('tag-numeric').textContent = `${numericCols.length} numeric`;
        show('controls-section');
        runAnalysis();
    }



    /* ── Main analysis runner ─────────────────────────────────── */
    function runAnalysis() {
        const numericCols = getNumericCols(parsedData);
        if (numericCols.length < 2) {
            alert('Need at least 2 numeric columns to run analysis.'); return;
        }

        runButton.disabled = true;
        runButton.innerHTML = '<span class="spinner"></span> Running…';

        setTimeout(() => {
            try {
                const matrix = buildMatrix(parsedData, numericCols);
                const scaled  = standardize(matrix);

                // PCA
                pcaResult = pca(scaled, 2);

                // K-Means
                const K = parseInt(kSlider.value);
                kmeansResult = kMeans(pcaResult.projected, K);

                // Elbow
                const maxK = parseInt(maxKSlider.value);
                const elbowData = elbowMethod(pcaResult.projected, maxK);

                // DBSCAN
                const eps    = parseFloat(epsSlider.value) / 10;
                const minPts = parseInt(minPtsSlider.value);
                dbscanResult = dbscan(pcaResult.projected, eps, minPts);

                // Metrics
                updateMetrics(elbowData);

                // Enrich rows
                fullRows = parsedData.rows.map((r, i) => ({
                    ...r,
                    __km: kmeansResult.labels[i],
                    __db: dbscanResult.labels[i]
                }));

                // Charts
                show('charts-section');
                show('metrics-strip');
                show('data-table');

                drawPCAChart(pcaResult.projected);
                drawElbowChart(elbowData);
                drawKMeansChart(pcaResult.projected, kmeansResult);
                drawDBSCANChart(pcaResult.projected, dbscanResult);
                buildDistribution(parsedData, numericCols);
                buildHeatmap(parsedData, numericCols);
                renderTable(fullRows, parsedData.headers);

                // Animate cards
                document.querySelectorAll('.chart-card, #data-table, #metrics-strip').forEach((el, i) => {
                    el.style.animationDelay = `${i * 0.05}s`;
                    el.classList.add('fade-in');
                });
            } catch(e) {
                console.error(e);
                alert('Analysis error: ' + e.message);
            }

            runButton.disabled = false;
            runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Analysis';
        }, 20);
    }

    /* ════════════════════════════════════════════════════════════
       MATH UTILITIES
    ════════════════════════════════════════════════════════════ */

    function getNumericCols(data) {
        return data.headers.filter(h =>
            data.rows.every(r => r[h] !== null && r[h] !== undefined && r[h] !== '' && !isNaN(Number(r[h])))
        );
    }

    function buildMatrix(data, cols) {
        return data.rows.map(r => cols.map(c => Number(r[c])));
    }

    function standardize(matrix) {
        const n = matrix.length;
        const d = matrix[0].length;
        const means = Array(d).fill(0);
        const stds  = Array(d).fill(0);

        matrix.forEach(row => row.forEach((v, j) => means[j] += v));
        means.forEach((_, j) => means[j] /= n);

        matrix.forEach(row => row.forEach((v, j) => stds[j] += (v - means[j]) ** 2));
        stds.forEach((_, j) => stds[j] = Math.sqrt(stds[j] / n) || 1);

        return matrix.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
    }

    /* ── PCA (covariance → power iteration for top 2 eigenvectors) */
    function pca(X, nComponents = 2) {
        const n = X.length;
        const d = X[0].length;

        // Covariance matrix
        const cov = Array.from({length: d}, () => Array(d).fill(0));
        for (let i = 0; i < n; i++)
            for (let a = 0; a < d; a++)
                for (let b = 0; b < d; b++)
                    cov[a][b] += X[i][a] * X[i][b];
        for (let a = 0; a < d; a++)
            for (let b = 0; b < d; b++)
                cov[a][b] /= (n - 1);

        // Power iteration to find top nComponents eigenvectors
        const eigenvectors = [];
        const eigenvalues  = [];
        let deflated = cov.map(r => [...r]);

        for (let k = 0; k < nComponents; k++) {
            let vec = Array.from({length: d}, () => Math.random() - 0.5);
            vec = normalizeVec(vec);

            for (let iter = 0; iter < 200; iter++) {
                const next = matVecMul(deflated, vec);
                const norm = Math.sqrt(next.reduce((s, v) => s + v*v, 0));
                if (norm < 1e-12) break;
                vec = next.map(v => v / norm);
            }

            const lambda = rayleighQuotient(deflated, vec);
            eigenvectors.push(vec);
            eigenvalues.push(lambda);

            // Deflate
            for (let a = 0; a < d; a++)
                for (let b = 0; b < d; b++)
                    deflated[a][b] -= lambda * vec[a] * vec[b];
        }

        // Project
        const projected = X.map(row =>
            eigenvectors.map(ev => dot(row, ev))
        );

        const totalVar  = cov.reduce((s, r, i) => s + r[i], 0);
        const varRatio  = eigenvalues.map(e => e / (totalVar || 1));

        return { projected, eigenvectors, eigenvalues, varRatio };
    }

    function matVecMul(M, v) {
        return M.map(row => row.reduce((s, m, j) => s + m * v[j], 0));
    }

    function normalizeVec(v) {
        const n = Math.sqrt(v.reduce((s, x) => s + x*x, 0));
        return v.map(x => x / (n || 1));
    }

    function rayleighQuotient(M, v) {
        const Mv = matVecMul(M, v);
        return dot(v, Mv) / (dot(v, v) || 1);
    }

    function dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }

    /* ── K-Means ─────────────────────────────────────────────── */
    function kMeans(X, K, maxIter = 100) {
        const n = X.length;
        // Init centroids via K-Means++
        let centroids = kMeansPlusPlus(X, K);
        let labels = new Int32Array(n);

        for (let iter = 0; iter < maxIter; iter++) {
            const prev = labels.slice();

            // Assign
            for (let i = 0; i < n; i++) {
                let best = 0, bestD = Infinity;
                for (let k = 0; k < K; k++) {
                    const d = euclidean2(X[i], centroids[k]);
                    if (d < bestD) { bestD = d; best = k; }
                }
                labels[i] = best;
            }

            // Update
            const sums   = Array.from({length: K}, () => Array(X[0].length).fill(0));
            const counts = Array(K).fill(0);
            for (let i = 0; i < n; i++) {
                const k = labels[i];
                counts[k]++;
                X[i].forEach((v, j) => sums[k][j] += v);
            }
            centroids = sums.map((s, k) =>
                counts[k] ? s.map(v => v / counts[k]) : centroids[k]
            );

            // Converged?
            if (prev.every((v, i) => v === labels[i])) break;
        }

        const inertia = X.reduce((s, x, i) => s + euclidean2(x, centroids[labels[i]]), 0);
        return { labels: Array.from(labels), centroids, inertia };
    }

    function kMeansPlusPlus(X, K) {
        const n = X.length;
        const idx = [Math.floor(Math.random() * n)];
        while (idx.length < K) {
            const dists = X.map(x => {
                let minD = Infinity;
                idx.forEach(i => { const d = euclidean2(x, X[i]); if (d < minD) minD = d; });
                return minD;
            });
            const total = dists.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            for (let i = 0; i < n; i++) { r -= dists[i]; if (r <= 0) { idx.push(i); break; } }
            if (idx.length < K && idx.length === idx.length - 1) idx.push(0); // fallback
        }
        return idx.map(i => [...X[i]]);
    }

    function euclidean2(a, b) { return a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0); }
    function euclidean(a, b)  { return Math.sqrt(euclidean2(a, b)); }

    /* ── Elbow method ─────────────────────────────────────────── */
    function elbowMethod(X, maxK) {
        const results = [];
        for (let k = 1; k <= maxK; k++) {
            const { inertia } = kMeans(X, k);
            results.push({ k, inertia });
        }
        return results;
    }

    function findElbow(data) {
        if (data.length < 3) return data[data.length - 1]?.k ?? 2;
        const n = data.length;
        const p1 = [data[0].k, data[0].inertia];
        const p2 = [data[n-1].k, data[n-1].inertia];
        let maxD = -Infinity, bestK = 2;
        for (const d of data) {
            const dist = pointLineDistance([d.k, d.inertia], p1, p2);
            if (dist > maxD) { maxD = dist; bestK = d.k; }
        }
        return bestK;
    }

    function pointLineDistance(p, a, b) {
        const ab = [b[0]-a[0], b[1]-a[1]];
        const ap = [p[0]-a[0], p[1]-a[1]];
        const abLen = Math.sqrt(ab[0]**2 + ab[1]**2);
        if (abLen === 0) return 0;
        return Math.abs(ab[0]*ap[1] - ab[1]*ap[0]) / abLen;
    }

    /* ── DBSCAN ──────────────────────────────────────────────── */
    function dbscan(X, eps, minPts) {
        const n = X.length;
        const labels = new Int32Array(n).fill(-2); // -2 = unvisited
        let clusterId = 0;

        const eps2 = eps * eps;
        const neighbors = i => {
            const res = [];
            for (let j = 0; j < n; j++)
                if (euclidean2(X[i], X[j]) <= eps2) res.push(j);
            return res;
        };

        for (let i = 0; i < n; i++) {
            if (labels[i] !== -2) continue;
            const nb = neighbors(i);
            if (nb.length < minPts) { labels[i] = -1; continue; } // noise

            labels[i] = clusterId;
            const queue = nb.filter(j => j !== i);

            while (queue.length) {
                const q = queue.shift();
                if (labels[q] === -1) labels[q] = clusterId;
                if (labels[q] !== -2) continue;
                labels[q] = clusterId;
                const qnb = neighbors(q);
                if (qnb.length >= minPts)
                    qnb.forEach(j => { if (labels[j] === -2 || labels[j] === -1) queue.push(j); });
            }
            clusterId++;
        }

        const numClusters = clusterId;
        const noiseCount  = Array.from(labels).filter(l => l === -1).length;
        return { labels: Array.from(labels), numClusters, noiseCount };
    }

    /* ── Pearson Correlation ─────────────────────────────────── */
    function pearson(a, b) {
        const n = a.length;
        const ma = a.reduce((s, v) => s + v, 0) / n;
        const mb = b.reduce((s, v) => s + v, 0) / n;
        let num = 0, da = 0, db = 0;
        for (let i = 0; i < n; i++) {
            const xa = a[i] - ma, xb = b[i] - mb;
            num += xa * xb; da += xa * xa; db += xb * xb;
        }
        return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
    }

    /* ════════════════════════════════════════════════════════════
       CHART DRAWING
    ════════════════════════════════════════════════════════════ */

    const CHART_DEFAULTS = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
            legend: {
                labels: { color: '#8892a4', font: { family: 'Space Mono', size: 11 }, boxWidth: 10 }
            }
        },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { family: 'Space Mono', size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { family: 'Space Mono', size: 10 } } }
        }
    };

    function destroyChart(id) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    }

    /* PCA scatter (coloured by K-Means cluster if available) */
    function drawPCAChart(projected) {
        destroyChart('pca');
        const ctx = document.getElementById('pcaChart').getContext('2d');

        const labels = kmeansResult ? kmeansResult.labels : projected.map(() => 0);
        const K = kmeansResult ? kmeansResult.centroids.length : 1;

        const datasets = Array.from({length: K}, (_, k) => ({
            label: `Cluster ${k+1}`,
            data: projected
                .filter((_, i) => labels[i] === k)
                .map(p => ({ x: p[0], y: p[1] })),
            backgroundColor: hexAlpha(CLUSTER_COLORS[k % CLUSTER_COLORS.length], 0.7),
            pointRadius: 4,
            pointHoverRadius: 6
        }));

        const vr = pcaResult?.varRatio ?? [0, 0];

        charts['pca'] = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                ...CHART_DEFAULTS,
                plugins: {
                    ...CHART_DEFAULTS.plugins,
                    tooltip: { callbacks: {
                        label: ctx => `(${ctx.parsed.x.toFixed(2)}, ${ctx.parsed.y.toFixed(2)})`
                    }}
                },
                scales: {
                    x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: `PC1 (${(vr[0]*100).toFixed(1)}% var)`, color: '#4a5568', font: { family: 'Space Mono', size: 10 } } },
                    y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: `PC2 (${(vr[1]*100).toFixed(1)}% var)`, color: '#4a5568', font: { family: 'Space Mono', size: 10 } } }
                }
            }
        });
    }

    /* Elbow chart */
    function drawElbowChart(elbowData) {
        destroyChart('elbow');
        const ctx = document.getElementById('bestKChart').getContext('2d');
        const bestK = findElbow(elbowData);

        charts['elbow'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: elbowData.map(d => d.k),
                datasets: [{
                    label: 'Inertia',
                    data: elbowData.map(d => d.inertia),
                    borderColor: '#a259ff',
                    backgroundColor: 'rgba(162,89,255,0.12)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: elbowData.map(d => d.k === bestK ? 8 : 4),
                    pointBackgroundColor: elbowData.map(d => d.k === bestK ? '#ff3d71' : '#a259ff'),
                    pointBorderColor: elbowData.map(d => d.k === bestK ? '#ff3d71' : '#a259ff'),
                    borderWidth: 2
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                plugins: {
                    ...CHART_DEFAULTS.plugins,
                    tooltip: { callbacks: {
                        label: ctx => `Inertia: ${ctx.parsed.y.toFixed(2)}${ctx.parsed.x === bestK ? '  ◀ suggested' : ''}`
                    }}
                },
                scales: {
                    x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: 'K', color: '#4a5568', font: { family: 'Space Mono', size: 10 } } },
                    y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'Inertia', color: '#4a5568', font: { family: 'Space Mono', size: 10 } } }
                }
            }
        });
    }

    /* K-Means chart */
    function drawKMeansChart(projected, km) {
        destroyChart('kmeans');
        const ctx = document.getElementById('kmeansChart').getContext('2d');
        const { labels, centroids } = km;
        const K = centroids.length;

        const clusterDatasets = Array.from({length: K}, (_, k) => ({
            label: `Cluster ${k+1}`,
            data: projected.filter((_, i) => labels[i] === k).map(p => ({ x: p[0], y: p[1] })),
            backgroundColor: hexAlpha(CLUSTER_COLORS[k % CLUSTER_COLORS.length], 0.65),
            pointRadius: 4,
            pointHoverRadius: 6
        }));

        const centroidDataset = {
            label: 'Centroids',
            data: centroids.map(c => ({ x: c[0], y: c[1] })),
            backgroundColor: '#fff',
            pointStyle: 'crossRot',
            pointRadius: 10,
            pointHoverRadius: 12,
            borderColor: '#fff',
            borderWidth: 2,
            showLine: false
        };

        charts['kmeans'] = new Chart(ctx, {
            type: 'scatter',
            data: { datasets: [...clusterDatasets, centroidDataset] },
            options: CHART_DEFAULTS
        });
    }

    /* DBSCAN chart */
    function drawDBSCANChart(projected, db) {
        destroyChart('dbscan');
        const ctx = document.getElementById('dbscanChart').getContext('2d');
        const { labels, numClusters } = db;

        const datasets = [];
        for (let k = 0; k < numClusters; k++) {
            datasets.push({
                label: `Cluster ${k+1}`,
                data: projected.filter((_, i) => labels[i] === k).map(p => ({ x: p[0], y: p[1] })),
                backgroundColor: hexAlpha(CLUSTER_COLORS[k % CLUSTER_COLORS.length], 0.7),
                pointRadius: 4,
                pointHoverRadius: 6
            });
        }

        datasets.push({
            label: 'Noise',
            data: projected.filter((_, i) => labels[i] === -1).map(p => ({ x: p[0], y: p[1] })),
            backgroundColor: 'rgba(100,100,100,0.4)',
            pointStyle: 'crossRot',
            pointRadius: 5,
            borderColor: 'rgba(100,100,100,0.4)',
            borderWidth: 1
        });

        charts['dbscan'] = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: CHART_DEFAULTS
        });
    }

    /* Feature distribution (histogram) */
    function buildDistribution(data, numericCols) {
        const tabs = document.getElementById('featTabs');
        tabs.innerHTML = '';
        numericCols.forEach((col, i) => {
            const btn = document.createElement('button');
            btn.className = 'feat-tab' + (i === 0 ? ' active' : '');
            btn.textContent = col;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.feat-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                drawHistogram(data, col);
            });
            tabs.appendChild(btn);
        });
        if (numericCols.length > 0) drawHistogram(data, numericCols[0]);
    }

    function drawHistogram(data, col) {
        destroyChart('dist');
        const ctx = document.getElementById('distChart').getContext('2d');
        const vals = data.rows.map(r => Number(r[col])).filter(v => !isNaN(v));
        const bins = 20;
        const min = Math.min(...vals), max = Math.max(...vals);
        const step = (max - min) / bins || 1;
        const counts = Array(bins).fill(0);
        const labels = Array.from({length: bins}, (_, i) => (min + i * step).toFixed(2));
        vals.forEach(v => {
            const idx = Math.min(Math.floor((v - min) / step), bins - 1);
            counts[idx]++;
        });

        charts['dist'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: col,
                    data: counts,
                    backgroundColor: 'rgba(0,229,255,0.5)',
                    borderColor: '#00e5ff',
                    borderWidth: 1
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
                scales: {
                    x: { ...CHART_DEFAULTS.scales.x, ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxTicksLimit: 10 } },
                    y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'Count', color: '#4a5568', font: { family: 'Space Mono', size: 10 } } }
                }
            }
        });
    }

    /* Correlation heatmap */
    function buildHeatmap(data, numericCols) {
        const container = document.getElementById('heatmap-container');
        container.innerHTML = '';
        const d = numericCols.length;
        if (d < 2) { container.innerHTML = '<p style="color:#4a5568;font-size:0.8rem;padding:16px;font-family:\'Space Mono\',monospace">Need ≥2 numeric columns for correlation.</p>'; return; }

        const cols = numericCols.slice(0, 12); // cap at 12 for readability
        const colData = cols.map(c => data.rows.map(r => Number(r[c])));
        const n = cols.length;

        const table = document.createElement('table');
        table.className = 'heatmap-table';

        // Header
        const thead = table.createTHead();
        const hr = thead.insertRow();
        hr.insertCell().textContent = '';
        cols.forEach(c => { const th = document.createElement('th'); th.textContent = c.length > 10 ? c.slice(0,10)+'…' : c; hr.appendChild(th); });

        // Body
        const tbody = table.createTBody();
        for (let i = 0; i < n; i++) {
            const row = tbody.insertRow();
            const labelCell = document.createElement('th');
            labelCell.textContent = cols[i].length > 10 ? cols[i].slice(0,10)+'…' : cols[i];
            row.appendChild(labelCell);
            for (let j = 0; j < n; j++) {
                const cell = row.insertCell();
                const r = pearson(colData[i], colData[j]);
                cell.textContent = r.toFixed(2);
                const [bg, fg] = corrColor(r);
                cell.style.background = bg;
                cell.style.color = fg;
                cell.title = `${cols[i]} × ${cols[j]}: ${r.toFixed(4)}`;
            }
        }

        container.appendChild(table);
    }

    function corrColor(r) {
        if (r > 0.7)  return ['rgba(0,229,255,0.8)', '#000'];
        if (r > 0.4)  return ['rgba(0,229,255,0.4)', '#e2e8f0'];
        if (r > 0.1)  return ['rgba(0,229,255,0.15)', '#e2e8f0'];
        if (r > -0.1) return ['rgba(30,36,46,0.8)', '#e2e8f0'];
        if (r > -0.4) return ['rgba(255,61,113,0.15)', '#e2e8f0'];
        if (r > -0.7) return ['rgba(255,61,113,0.4)', '#e2e8f0'];
        return ['rgba(255,61,113,0.8)', '#000'];
    }

    /* ════════════════════════════════════════════════════════════
       DATA TABLE
    ════════════════════════════════════════════════════════════ */

    let allTableRows = [];

    function renderTable(rows, headers) {
        allTableRows = rows;
        const extraCols = ['__km', '__db'];
        const allHeaders = [...headers, ...extraCols];
        drawTable(rows, allHeaders);

        tableSearch.addEventListener('input', () => {
            const q = tableSearch.value.toLowerCase();
            const filtered = allTableRows.filter(r =>
                headers.some(h => String(r[h]).toLowerCase().includes(q))
            );
            drawTable(filtered, allHeaders);
        });
    }

    function drawTable(rows, allHeaders) {
        const container = document.getElementById('table-content');
        container.innerHTML = '';
        const table = document.createElement('table');

        const thead = table.createTHead();
        const hr = thead.insertRow();
        allHeaders.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h === '__km' ? 'K-Means' : h === '__db' ? 'DBSCAN' : h;
            hr.appendChild(th);
        });

        const tbody = table.createTBody();
        const displayed = rows.slice(0, 500);
        displayed.forEach(row => {
            const tr = tbody.insertRow();
            allHeaders.forEach(h => {
                const td = tr.insertCell();
                if (h === '__km') {
                    const k = row[h];
                    td.innerHTML = `<span class="cluster-badge" style="background:${hexAlpha(CLUSTER_COLORS[k % CLUSTER_COLORS.length], 0.25)};color:${CLUSTER_COLORS[k % CLUSTER_COLORS.length]};border:1px solid ${hexAlpha(CLUSTER_COLORS[k % CLUSTER_COLORS.length], 0.4)}">C${k+1}</span>`;
                } else if (h === '__db') {
                    const l = row[h];
                    const label = l === -1 ? 'Noise' : `C${l+1}`;
                    const color = l === -1 ? '#4a5568' : CLUSTER_COLORS[l % CLUSTER_COLORS.length];
                    td.innerHTML = `<span class="cluster-badge" style="background:${hexAlpha(color, 0.2)};color:${color};border:1px solid ${hexAlpha(color, 0.35)}">${label}</span>`;
                } else {
                    td.textContent = row[h] !== undefined ? row[h] : '';
                }
            });
        });

        table.appendChild(tbody);
        container.appendChild(table);
        if (rows.length > 500) {
            const note = document.createElement('p');
            note.style.cssText = 'text-align:center;padding:12px;color:#4a5568;font-size:0.75rem;font-family:Space Mono,monospace';
            note.textContent = `Showing 500 of ${rows.length} rows`;
            container.appendChild(note);
        }
    }

    /* ── Metrics update ─────────────────────────────────────── */
    function updateMetrics(elbowData) {
        const vr = pcaResult?.varRatio ?? [0, 0];
        const bestK = findElbow(elbowData);

        document.getElementById('metric-inertia').textContent   = kmeansResult ? kmeansResult.inertia.toFixed(1) : '—';
        document.getElementById('metric-clusters').textContent  = dbscanResult ? dbscanResult.numClusters : '—';
        document.getElementById('metric-noise').textContent     = dbscanResult ? dbscanResult.noiseCount : '—';
        document.getElementById('metric-variance').textContent  = `${((vr[0]+vr[1])*100).toFixed(1)}%`;
        document.getElementById('metric-best-k').textContent    = bestK;
    }

    /* ── Helpers ────────────────────────────────────────────── */
    function hexAlpha(hex, a) {
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        return `rgba(${r},${g},${b},${a})`;
    }

    function setStatus(msg) {
        document.getElementById('status-text').textContent = msg;
    }

    function show(id) {
        document.getElementById(id).classList.remove('hidden');
    }


}); // end DOMContentLoaded
