/**
 * SageService - Handles Excel parsing and Sage X3 GAS transformation
 */
const SageService = {
    /**
     * Parses an Excel file and returns the data as JSON
     * @param {File} file 
     * @returns {Promise<Array>}
     */
    async parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Transforms JSON data to Sage X3 GAS import format
     * @param {Array} data 
     * @returns {String}
     */
    transformToGAS(data) {
        if (!data || data.length === 0) return "";

        // Standard Sage X3 GAS (Accounting Entry) structure:
        // G;Site;Journal;Date;Reference;Description;... (Header)
        // D;Account;Site;Date;Reference;Description;Debit;Credit;... (Line)

        let output = "";
        const delimiter = ";";

        // Group data by pieces if necessary, but here we assume one piece or simple flat list
        // For simplicity, we'll create one header per file or per unique reference if detected

        const pieces = this.groupByPiece(data);

        for (const [ref, lines] of Object.entries(pieces)) {
            const firstLine = lines[0];
            const site = firstLine.Site || firstLine.Etablissement || "SOC01";
            const journal = firstLine.Journal || firstLine.CodeJournal || "OD";
            const date = this.formatDate(firstLine.Date || firstLine.DateComptable);
            const description = firstLine.Description || firstLine.Libelle || "Import Excel";
            const currency = firstLine.Devise || "EUR";

            // Header Line (G)
            // G;Site;Journal;Date;Cur;Ref;Des;...
            output += `G${delimiter}${site}${delimiter}${journal}${delimiter}${date}${delimiter}${currency}${delimiter}${ref}${delimiter}${description}\r\n`;

            // Detail Lines (D)
            for (const line of lines) {
                const account = line.Compte || line.Account || "";
                const lineDes = line.Description || line.Libelle || description;
                const debit = line.Debit || 0;
                const credit = line.Credit || 0;
                const tax = line.Taxe || "";

                // D;Account;Des;Debit;Credit;...
                output += `D${delimiter}${account}${delimiter}${lineDes}${delimiter}${debit}${delimiter}${credit}${delimiter}${tax}\r\n`;
            }
        }

        return output;
    },

    /**
     * Groups rows by a piece identifier (Reference or Date+Journal)
     */
    groupByPiece(data) {
        const pieces = {};
        data.forEach((row, index) => {
            const ref = row.Reference || row.Piece || row.N_Piece || `REF-${row.Date || 'NO-DATE'}-${index}`;
            if (!pieces[ref]) pieces[ref] = [];
            pieces[ref].push(row);
        });
        return pieces;
    },

    /**
     * Formats date to YYYYMMDD
     */
    formatDate(dateStr) {
        if (!dateStr) return new Date().toISOString().slice(0, 10).replace(/-/g, '');

        let d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            // Try DD/MM/YYYY
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        }

        if (isNaN(d.getTime())) return dateStr; // Return as is if failed

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    },

    /**
     * Downloads the transformed content as a file
     */
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }
};
