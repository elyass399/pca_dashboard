document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');

    uploadButton.addEventListener('click', handleFileUpload);

    function handleFileUpload() {
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a CSV file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            const csvData = e.target.result;
            const data = parseCSV(csvData);
            renderDataTable(data);
            // Placeholder: Call functions to update charts with data
            // updatePCAChart(data);
            // updateBestKChart(data);
            // updateKMeansChart(data);
            // updateDBSCANChart(data);
        };
        reader.readAsText(file);
    }

    function parseCSV(csv) {
        const lines = csv.trim().split('\n');
        const headers = lines[0].split(',');
        const rows = lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, i) => {
                obj[header.trim()] = values[i] ? values[i].trim() : '';
            });
            return obj;
        });
        return { headers, rows };
    }

    function renderDataTable(data) {
        const container = document.getElementById('Data Table');
        container.innerHTML = '';
        if (!data || !data.rows.length) return;
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
        data.rows.forEach(row => {
            const tr = document.createElement('tr');
            data.headers.forEach(header => {
                const td = document.createElement('td');
                td.textContent = row[header];
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }

    // Placeholder chart update functions
    function updatePCAChart(data) {
        // Implement PCA chart rendering using Chart.js or similar
    }
    function updateBestKChart(data) {
        // Implement Best K chart rendering
    }
    function updateKMeansChart(data) {
        // Implement KMeans chart rendering
    }
    function updateDBSCANChart(data) {
        // Implement DBSCAN chart rendering
    }
});