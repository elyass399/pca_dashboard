document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM completamente caricato');

    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const dataTableContent = document.getElementById('table-content'); // Nuovo contenitore per la tabella
    
    // Variabile globale per conservare i dati parsati
    let parsedData = { headers: [], rows: [] };

    console.log('🔍 Elementi trovati:', { fileInput, uploadButton, dataTableContent });

    uploadButton.addEventListener('click', handleFileUpload);

    // === FUNZIONE PRINCIPALE ===
    function handleFileUpload() {
        console.log('📁 Bottone upload cliccato');

        const file = fileInput.files[0];
        if (!file) {
            alert('⚠️ Seleziona un file CSV prima di caricare.');
            console.log('❌ Nessun file selezionato');
            return;
        }

        console.log('📄 File selezionato:', file.name, 'Dimensione:', file.size, 'byte');

        const reader = new FileReader();

        reader.onloadstart = () => {
            console.log('📤 Inizio lettura del file...');
            dataTableContent.innerHTML = '<p class="no-data-message">Caricamento e parsing del file...</p>'; // Messaggio durante il caricamento
        };
        reader.onerror = (e) => {
            console.error('❌ Errore durante la lettura del file:', e);
            alert('Errore durante la lettura del file. Controlla la console per dettagli.');
            dataTableContent.innerHTML = '<p class="no-data-message">Errore durante il caricamento del file.</p>';
        };
        reader.onloadend = () => console.log('✅ Lettura file completata');

        reader.onload = function (e) {
            const csvData = e.target.result;
            console.log('🧩 Dati grezzi CSV letti (prime 200 lettere):', csvData.slice(0, 200));

            // Puoi scegliere quale parser usare qui:
            // 1. Il tuo parser Vanilla JS migliorato
            parsedData = parseCSV(csvData); // Usa il tuo parser
            
            // 2. O PapaParse (decommenta e commenta la riga sopra se vuoi usarlo)
            /*
            Papa.parse(csvData, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    parsedData = {
                        headers: results.meta.fields || [],
                        rows: results.data || []
                    };
                    console.log('✅ Parsing completato con PapaParse:', {
                        headers: parsedData.headers,
                        numRows: parsedData.rows.length,
                        exampleRow: parsedData.rows[0]
                    });
                    renderDataTable(parsedData);
                    // Chiamate future per i grafici
                    updatePCAChart(parsedData);
                    updateBestKChart(parsedData);
                    updateKMeansChart(parsedData);
                    updateDBSCANChart(parsedData);
                },
                error: function(err) {
                    console.error('❌ Errore durante il parsing con PapaParse:', err);
                    alert('Si è verificato un errore durante il parsing del file CSV: ' + err.message);
                    dataTableContent.innerHTML = '<p class="no-data-message">Errore durante il parsing del file con PapaParse.</p>';
                }
            });
            return; // Esci dalla funzione, il resto del codice verrà eseguito nella callback di PapaParse
            */


            console.log('📊 Risultato parsing CSV:', {
                headers: parsedData.headers,
                numRows: parsedData.rows.length,
                exampleRow: parsedData.rows[0]
            });

            renderDataTable(parsedData);
            
            // Qui in futuro chiamerai le funzioni per popolare i grafici
            updatePCAChart(parsedData);
            updateBestKChart(parsedData);
            updateKMeansChart(parsedData);
            updateDBSCANChart(parsedData);
        };

        reader.readAsText(file);
    }

    // === PARSING CSV (Vanilla JS - Versione robusta) ===
    function parseCSV(csv) {
        console.log('⚙️ Avvio parsing CSV robusto (Vanilla JS)...');

        // 1. Pulizia generale e gestione righe vuote
        const lines = csv.trim().split('\n').filter(line => line.trim() !== ''); // Rimuove righe completamente vuote

        if (lines.length === 0) {
            console.warn('⚠️ Il file CSV è vuoto o contiene solo righe valide.');
            return { headers: [], rows: [] };
        }

        // 2. Rilevamento automatico del separatore
        const potentialSeparators = [',', ';', '\t', '|']; // Aggiungiamo tab e pipe
        let separator = ','; // Default
        let maxSeparatorCount = -1;

        // Analizziamo la prima riga per il separatore
        const firstLine = lines[0];
        potentialSeparators.forEach(s => {
            const count = (firstLine.match(new RegExp('\\' + s, 'g')) || []).length;
            if (count > maxSeparatorCount) {
                maxSeparatorCount = count;
                separator = s;
            }
        });

        // Se nessun separatore è stato trovato nella prima riga ma ci sono altre righe,
        // proviamo ad analizzare la seconda riga per una migliore stima.
        if (maxSeparatorCount === 0 && lines.length > 1) {
            const secondLine = lines[1];
            potentialSeparators.forEach(s => {
                const count = (secondLine.match(new RegExp('\\' + s, 'g')) || []).length;
                if (count > maxSeparatorCount) {
                    maxSeparatorCount = count;
                    separator = s;
                }
            });
        }
        
        console.log('🔎 Separatore rilevato:', separator);
        console.log('📏 Numero righe valide trovate:', lines.length);

        // 3. Parsing degli header
        // Usa una regex per split che tenga conto delle virgolette doppie per gli header
        // Questo è ancora una semplificazione; un parser full-featured sarebbe necessario per casi complessi
        const headerMatch = firstLine.match(/(".*?"|[^",;\t|]*)([,;\t|]|$)/g);
        const headers = headerMatch ? headerMatch.map(h => h.replace(/^(["'])(.*)\1$/, '$2').replace(/""/g, '"').trim()).filter(h => h !== '') : firstLine.split(separator).map(h => h.trim());

        // Se il rilevamento regex fallisce o non produce header, usa il vecchio metodo
        if (headers.length === 0) {
             console.warn('⚠️ Rilevamento header tramite regex fallito o non ha prodotto risultati, usando split semplice.');
             const tempHeaders = firstLine.split(separator).map(header => header.trim());
             // Filtra gli header vuoti che potrebbero derivare da separatori extra alla fine
             headers.push(...tempHeaders.filter(h => h !== ''));
        }

        console.log('📋 Headers rilevati:', headers);

        // 4. Parsing delle righe dati
        const rows = lines.slice(1).map((line, index) => {
            // Un parser CSV robusto per le righe (specialmente con virgolette e separatori interni)
            // richiederebbe una logica più complessa. Questa è una versione migliorata ma ancora semplificata.
            const values = [];
            let inQuote = false;
            let currentField = '';

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    if (inQuote && line[i + 1] === '"') { // "double""quote" -> "double"quote
                        currentField += '"';
                        i++; // Salta il secondo apice
                    } else {
                        inQuote = !inQuote;
                    }
                } else if (char === separator && !inQuote) {
                    values.push(currentField.trim());
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
            values.push(currentField.trim()); // Aggiungi l'ultimo campo

            const obj = {};
            headers.forEach((header, i) => {
                // Tenta di convertire i valori a numeri se possibile
                const rawValue = values[i] !== undefined ? values[i] : '';
                const numValue = Number(rawValue);
                obj[header] = isNaN(numValue) || rawValue.trim() === '' ? rawValue : numValue;
            });
            return obj;
        });

        console.log('✅ Parsing completato (Vanilla JS), totale righe:', rows.length);
        return { headers, rows };
    }

    // === VISUALIZZAZIONE DATI (TABELLARE) ===
    function renderDataTable(data) {
        console.log('🧱 Rendering tabella...');

        // Rimuove la tabella precedente o il messaggio di caricamento
        dataTableContent.innerHTML = '';

        if (!data || !data.rows || data.rows.length === 0 || !data.headers || data.headers.length === 0) {
            console.warn('⚠️ Nessuna riga o header valido trovato nel CSV per la tabella.');
            dataTableContent.innerHTML = '<p class="no-data-message">Nessun dato valido da visualizzare. Controlla il formato del file CSV o la console per errori.</p>';
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');

        data.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            trHead.appendChild(th);
        });

        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        data.rows.forEach((row) => {
            const tr = document.createElement('tr');
            data.headers.forEach(header => {
                const td = document.createElement('td');
                // Gestisce il caso in cui un campo possa mancare in una riga (es. file malformato)
                td.textContent = row[header] !== undefined ? row[header] : ''; 
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        dataTableContent.appendChild(table); // Appende al nuovo contenitore

        console.log('✅ Tabella renderizzata correttamente con', data.rows.length, 'righe e', data.headers.length, 'colonne.');
    }

    // === PLACEHOLDERS PER FUTURI GRAFICI ===
    function updatePCAChart(data) {
        console.log('📊 [Placeholder] PCA chart update con', data.rows.length, 'righe.');
        const ctx = document.getElementById('pcaChart').getContext('2d');
        if (window.pcaChartInstance) {
            window.pcaChartInstance.destroy();
        }
        window.pcaChartInstance = new Chart(ctx, {
            type: 'scatter', // O 'bar', 'line', ecc.
            data: {
                labels: [], // Dipenderà dai dati PCA
                datasets: [{
                    label: 'PCA Data (Placeholder)',
                    data: [{x:1, y:2}, {x:3, y:4}, {x:2, y:1}], // Dati di esempio
                    backgroundColor: 'rgba(75, 192, 192, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom'
                    },
                    y: {
                        type: 'linear',
                        position: 'left'
                    }
                }
            }
        });
    }

    function updateBestKChart(data) {
        console.log('📈 [Placeholder] Best K chart update con', data.rows.length, 'righe.');
        const ctx = document.getElementById('bestKChart').getContext('2d');
        if (window.bestKChartInstance) {
            window.bestKChartInstance.destroy();
        }
        window.bestKChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1', '2', '3', '4', '5'],
                datasets: [{
                    label: 'Inertia (Elbow Method Placeholder)',
                    data: [100, 50, 20, 18, 17], // Dati di esempio
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    function updateKMeansChart(data) {
        console.log('🎯 [Placeholder] KMeans chart update con', data.rows.length, 'righe.');
        const ctx = document.getElementById('kmeansChart').getContext('2d');
        if (window.kmeansChartInstance) {
            window.kmeansChartInstance.destroy();
        }
        window.kmeansChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: [],
                datasets: [{
                    label: 'Cluster 1 (Placeholder)',
                    data: [{x:1, y:1}, {x:1.5, y:1.5}],
                    backgroundColor: 'rgba(255, 99, 132, 0.6)'
                },
                {
                    label: 'Cluster 2 (Placeholder)',
                    data: [{x:3, y:3}, {x:3.5, y:3.5}],
                    backgroundColor: 'rgba(54, 162, 235, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'linear', position: 'bottom' },
                    y: { type: 'linear', position: 'left' }
                }
            }
        });
    }

    function updateDBSCANChart(data) {
        console.log('🌐 [Placeholder] DBSCAN chart update con', data.rows.length, 'righe.');
        const ctx = document.getElementById('dbscanChart').getContext('2d');
        if (window.dbscanChartInstance) {
            window.dbscanChartInstance.destroy();
        }
        window.dbscanChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: [],
                datasets: [{
                    label: 'Core Points (Placeholder)',
                    data: [{x:1, y:5}, {x:1.2, y:4.8}],
                    backgroundColor: 'rgba(255, 206, 86, 0.6)'
                },
                {
                    label: 'Border Points (Placeholder)',
                    data: [{x:1.5, y:5.2}, {x:0.8, y:4.5}],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)'
                },
                {
                    label: 'Noise (Placeholder)',
                    data: [{x:5, y:1}, {x:0.5, y:0.5}],
                    backgroundColor: 'rgba(201, 203, 207, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'linear', position: 'bottom' },
                    y: { type: 'linear', position: 'left' }
                }
            }
        });
    }
});