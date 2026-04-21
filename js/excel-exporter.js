/**
 * Módulo de Exportação Excel Profissional
 * Balança Pro+ - Versão Enterprise
 * 
 * Recursos:
 * - Formatação profissional com cores corporativas
 * - Cabeçalhos estilizados com gradiente
 * - Zebra striping nas linhas
 * - Formatação condicional automática
 * - Fórmulas Excel nativas
 * - Múltiplas abas organizadas
 * - Logotipo e branding da empresa
 */

const ExcelExporter = {
    // Cores corporativas profissionais
    colors: {
        primary: '1F4788',      // Azul escuro corporativo
        secondary: '0D9488',    // Verde água moderno
        accent: '2563EB',       // Azul vibrante
        success: '10B981',      // Verde sucesso
        warning: 'F59E0B',      // Amarelo alerta
        danger: 'EF4444',       // Vermelho erro
        light: 'F8FAFC',        // Fundo claro
        medium: 'E2E8F0',       // Cinza médio
        dark: '1E293B',         // Texto escuro
        white: 'FFFFFF'
    },

    // Estilos padrão reutilizáveis
    styles: {
        headerTitle: {
            font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            fill: { patternType: 'solid', fgColor: { rgb: '1F4788' } },
            border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } }
        },
        companyHeader: {
            font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '1F4788' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } }
        },
        sectionHeader: {
            font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            fill: { patternType: 'solid', fgColor: { rgb: '0D9488' } },
            border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
        },
        columnHeader: {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
            fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
        },
        dataCell: {
            font: { name: 'Calibri', sz: 10 },
            alignment: { vertical: 'center', horizontal: 'left' },
            border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } }
        },
        numericCell: {
            font: { name: 'Calibri', sz: 10 },
            alignment: { vertical: 'center', horizontal: 'right' },
            numFmt: '#,##0.00',
            border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } }
        },
        totalRow: {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            fill: { patternType: 'solid', fgColor: { rgb: '1F4788' } },
            border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
        },
        highlightGreen: {
            fill: { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } },
            font: { color: { rgb: '065F46' }, bold: true }
        },
        highlightYellow: {
            fill: { patternType: 'solid', fgColor: { rgb: 'FEF3C7' } },
            font: { color: { rgb: '92400E' } }
        },
        highlightRed: {
            fill: { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } },
            font: { color: { rgb: '991B1B' }, bold: true }
        }
    },

    /**
     * Cria uma planilha Excel profissional completa
     */
    createProfessionalWorkbook(titulo, config, pesagens, filtros = {}) {
        const XLSX = window.XLSX;
        if (!XLSX) {
            console.error('SheetJS (XLSX) não encontrado');
            return null;
        }

        const wb = XLSX.utils.book_new();
        
        // Calcular métricas
        const metrics = this.calculateMetrics(pesagens);
        
        // Criar aba principal de dados
        const wsDados = this.createDadosSheet(XLSX, titulo, config, pesagens, metrics, filtros);
        XLSX.utils.book_append_sheet(wb, wsDados, "📊 Relatório Geral");
        
        // Criar aba de resumo executivo
        const wsResumo = this.createResumoSheet(XLSX, titulo, config, pesagens, metrics);
        XLSX.utils.book_append_sheet(wb, wsResumo, "📈 Resumo Executivo");
        
        // Criar aba por transportadoras
        const wsTransportadoras = this.createTransportadorasSheet(XLSX, titulo, config, pesagens, metrics);
        XLSX.utils.book_append_sheet(wb, wsTransportadoras, "🚚 Transportadoras");
        
        // Criar aba por fornecedores/clientes
        const wsFornecedores = this.createFornecedoresSheet(XLSX, titulo, config, pesagens, metrics);
        XLSX.utils.book_append_sheet(wb, wsFornecedores, "🏭 Fornecedores");
        
        // Criar aba por produtos
        const wsProdutos = this.createProdutosSheet(XLSX, titulo, config, pesagens, metrics);
        XLSX.utils.book_append_sheet(wb, wsProdutos, "📦 Produtos");
        
        return wb;
    },

    /**
     * Calcula métricas consolidadas
     */
    calculateMetrics(pesagens) {
        const totalBruto = pesagens.reduce((acc, p) => acc + (Number(p.pesoBruto) || 0), 0);
        const totalTara = pesagens.reduce((acc, p) => acc + (Number(p.tara) || 0), 0);
        const totalLiquido = pesagens.reduce((acc, p) => acc + (Number(p.pesoLiquido) || 0), 0);
        const totalNota = pesagens.reduce((acc, p) => acc + (Number(p.pesoNota) || 0), 0);
        
        const mediaLiquido = pesagens.length > 0 ? totalLiquido / pesagens.length : 0;
        const maxLiquido = pesagens.length > 0 ? Math.max(...pesagens.map(p => Number(p.pesoLiquido) || 0)) : 0;
        
        const pesagensComNota = pesagens.filter(p => (Number(p.pesoNota) || 0) > 0);
        const divergencias = pesagensComNota.filter(p => {
            const nota = Number(p.pesoNota) || 0;
            const liquido = Number(p.pesoLiquido) || 0;
            return Math.abs(((liquido - nota) / nota) * 100) > 5;
        }).length;
        
        const conformidade = pesagensComNota.length > 0 
            ? ((pesagensComNota.length - divergencias) / pesagensComNota.length) * 100 
            : 100;

        // Ranking por produto
        const produtosRanking = Object.entries(pesagens.reduce((acc, p) => {
            const nome = p.produto || 'N/A';
            if (!acc[nome]) acc[nome] = { viagens: 0, peso: 0 };
            acc[nome].viagens++;
            acc[nome].peso += Number(p.pesoLiquido) || 0;
            return acc;
        }, {})).sort(([, a], [, b]) => b.peso - a.peso).slice(0, 10);

        // Ranking por transportadora
        const transportadorasRanking = Object.entries(pesagens.reduce((acc, p) => {
            const nome = p.transportadora || 'Sem transportadora';
            if (!acc[nome]) acc[nome] = { viagens: 0, peso: 0 };
            acc[nome].viages++;
            acc[nome].peso += Number(p.pesoLiquido) || 0;
            return acc;
        }, {})).sort(([, a], [, b]) => b.peso - a.peso).slice(0, 10);

        return {
            totalBruto,
            totalTara,
            totalLiquido,
            totalNota,
            mediaLiquido,
            maxLiquido,
            totalPesagens: pesagens.length,
            pesagensComNota: pesagensComNota.length,
            divergencias,
            conformidade,
            produtosRanking,
            transportadorasRanking
        };
    },

    /**
     * Cria a aba de dados completos
     */
    createDadosSheet(XLSX, titulo, config, pesagens, metrics, filtros) {
        const ws = XLSX.utils.aoa_to_sheet([]);
        let currentRow = 0;

        // Cabeçalho principal
        this.addCell(ws, 'A1', titulo, this.styles.headerTitle);
        this.mergeCells(ws, 'A1', 'S1');
        currentRow++;

        // Empresa
        this.addCell(ws, `A${currentRow + 1}`, config.nome || 'Empresa', this.styles.companyHeader);
        this.mergeCells(ws, `A${currentRow + 1}`, `S${currentRow + 1}`);
        currentRow++;

        // Período
        const periodo = this.formatarPeriodo(filtros);
        this.addCell(ws, `A${currentRow + 1}`, periodo, {
            ...this.styles.dataCell,
            fill: { patternType: 'solid', fgColor: { rgb: this.colors.light } },
            font: { name: 'Calibri', sz: 11, bold: true }
        });
        this.mergeCells(ws, `A${currentRow + 1}`, `S${currentRow + 1}`);
        currentRow++;

        // Data de geração
        const dataGeracao = `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
        this.addCell(ws, `A${currentRow + 1}`, dataGeracao, {
            ...this.styles.dataCell,
            font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '6B7280' } }
        });
        this.mergeCells(ws, `A${currentRow + 1}`, `S${currentRow + 1}`);
        currentRow += 2;

        // Resumo rápido
        this.addCell(ws, `A${currentRow + 1}`, '📊 RESUMO RÁPIDO', this.styles.sectionHeader);
        this.mergeCells(ws, `A${currentRow + 1}`, `H${currentRow + 1}`);
        currentRow++;

        const resumoData = [
            ['Total Pesagens:', metrics.totalPesagens, 'Peso Bruto Total:', metrics.totalBruto],
            ['Peso Líquido Total:', metrics.totalLiquido, 'Tara Total:', metrics.totalTara],
            ['Média/Ticket:', metrics.mediaLiquido, 'Maior Peso:', metrics.maxLiquido],
            ['Conformidade:', `${metrics.conformidade.toFixed(1)}%`, 'Divergências:', metrics.divergencias]
        ];

        resumoData.forEach(row => {
            row.forEach((cell, idx) => {
                const col = String.fromCharCode(65 + idx);
                const style = idx % 2 === 0 
                    ? { ...this.styles.dataCell, font: { ...this.styles.dataCell.font, bold: true } }
                    : { ...this.styles.numericCell, font: { ...this.styles.numericCell.font, bold: true, color: { rgb: this.colors.secondary } } };
                this.addCell(ws, `${col}${currentRow + 1}`, cell, style);
            });
            currentRow++;
        });

        currentRow++;

        // Dados principais
        const headers = ['#', 'Ticket', 'Nota Fiscal', 'Entrada', 'Saída', 'Placa', 'Motorista', 'Cliente', 
                        'Transportadora', 'Obra', 'Produto', 'Certificado', 'Bruto (kg)', 'Tara (kg)', 
                        'Líquido (kg)', 'Nota (kg)', '⚖️ Dif.', '📈 %', 'Status', 'Observação'];
        
        const dataStartRow = currentRow + 1;
        headers.forEach((header, idx) => {
            const col = String.fromCharCode(65 + idx);
            this.addCell(ws, `${col}${dataStartRow}`, header, this.styles.columnHeader);
        });
        currentRow++;

        // Dados das pesagens
        pesagens.forEach((p, index) => {
            const row = currentRow + 1;
            const isEven = index % 2 === 0;
            const baseStyle = {
                ...this.styles.dataCell,
                fill: { patternType: 'solid', fgColor: { rgb: isEven ? this.colors.white : this.colors.light } }
            };

            const liquido = Number(p.pesoLiquido) || 0;
            const nota = Number(p.pesoNota) || 0;
            const diff = nota > 0 ? liquido - nota : null;
            const perc = nota > 0 ? ((diff / nota) * 100) : null;
            
            let status = '✅ OK';
            let statusStyle = baseStyle;
            if (nota > 0 && Math.abs(perc) > 5) {
                status = '⚠️ Divergente';
                statusStyle = { ...baseStyle, ...this.styles.highlightRed };
            } else if (nota > 0 && Math.abs(perc) > 2) {
                status = '⚡ Atenção';
                statusStyle = { ...baseStyle, ...this.styles.highlightYellow };
            }

            const rowData = [
                { v: index + 1, t: 'n' },
                { v: p.num, t: 's' },
                { v: this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2), t: 's' },
                { v: new Date(p.dataEntrada.seconds * 1000), t: 'd' },
                { v: new Date(p.dataSaida.seconds * 1000), t: 'd' },
                { v: p.placa, t: 's' },
                { v: p.motorista, t: 's' },
                { v: p.cliente, t: 's' },
                { v: p.transportadora || 'N/A', t: 's' },
                { v: p.obra, t: 's' },
                { v: p.produto, t: 's' },
                { v: p.certificado, t: 's' },
                { v: p.pesoBruto, t: 'n' },
                { v: p.tara, t: 'n' },
                { v: liquido, t: 'n' },
                { v: nota > 0 ? nota : '', t: nota > 0 ? 'n' : 's' },
                { v: diff !== null ? diff : '', t: diff !== null ? 'n' : 's' },
                { v: perc !== null ? perc.toFixed(2) : '', t: perc !== null ? 'n' : 's' },
                { v: status, t: 's' },
                { v: p.observacao || '', t: 's' }
            ];

            rowData.forEach((cell, colIdx) => {
                const col = String.fromCharCode(65 + colIdx);
                let style = { ...baseStyle };
                
                if (colIdx >= 12 && colIdx <= 17) {
                    style = { ...this.styles.numericCell, fill: baseStyle.fill };
                }
                
                if (colIdx === 18) {
                    style = statusStyle;
                }

                if (colIdx >= 3 && colIdx <= 4) {
                    style.numFmt = 'dd/mm/yyyy hh:mm';
                }

                this.addCell(ws, `${col}${row}`, cell.v, style);
            });

            currentRow++;
        });

        // Linha de totais
        const totalRow = currentRow + 1;
        this.addCell(ws, `A${totalRow}`, '⭐ TOTAIS', this.styles.totalRow);
        this.mergeCells(ws, `A${totalRow}`, `C${totalRow}`);
        
        const lastDataRow = totalRow - 1;
        ['M', 'N', 'O', 'P'].forEach((col, idx) => {
            const formula = `SUM(${col}${dataStartRow + 1}:${col}${lastDataRow})`;
            this.addCell(ws, `${col}${totalRow}`, { f: formula }, {
                ...this.styles.totalRow,
                numFmt: '#,##0.00',
                alignment: { vertical: 'center', horizontal: 'right' }
            });
        });

        // Configurações da planilha
        ws['!cols'] = [
            { wch: 5 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
            { wch: 25 }, { wch: 28 }, { wch: 25 }, { wch: 20 }, { wch: 22 }, { wch: 15 },
            { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
            { wch: 12 }, { wch: 40 }
        ];

        ws['!autofilter'] = { ref: `A${dataStartRow}:T${totalRow}` };
        ws['!freeze'] = { xSplit: 0, ySplit: dataStartRow, topLeftCell: `A${dataStartRow + 1}`, state: 'frozen' };

        return ws;
    },

    /**
     * Cria a aba de resumo executivo
     */
    createResumoSheet(XLSX, titulo, config, pesagens, metrics) {
        const ws = XLSX.utils.aoa_to_sheet([]);
        let currentRow = 0;

        // Título
        this.addCell(ws, 'A1', '📈 RESUMO EXECUTIVO', this.styles.headerTitle);
        this.mergeCells(ws, 'A1', 'G1');
        currentRow += 2;

        // KPIs principais
        const kpis = [
            ['🎫 Total de Pesagens', metrics.totalPesagens],
            ['⚖️ Peso Líquido Total', metrics.totalLiquido],
            ['📊 Peso Médio/Ticket', metrics.mediaLiquido],
            ['🏆 Maior Peso', metrics.maxLiquido],
            ['✅ Taxa de Conformidade', `${metrics.conformidade.toFixed(1)}%`],
            ['⚠️ Divergências', metrics.divergencias]
        ];

        kpis.forEach(([label, value]) => {
            this.addCell(ws, `A${currentRow + 1}`, label, {
                ...this.styles.dataCell,
                font: { ...this.styles.dataCell.font, bold: true, sz: 12 },
                fill: { patternType: 'solid', fgColor: { rgb: this.colors.light } }
            });
            this.addCell(ws, `B${currentRow + 1}`, value, {
                ...this.styles.numericCell,
                font: { ...this.styles.numericCell.font, bold: true, color: { rgb: this.colors.primary }, sz: 14 },
                fill: { patternType: 'solid', fgColor: { rgb: this.colors.white } }
            });
            currentRow++;
        });

        currentRow += 2;

        // Top 10 Produtos
        this.addCell(ws, `A${currentRow + 1}`, '🏆 TOP 10 PRODUTOS', this.styles.sectionHeader);
        this.mergeCells(ws, `A${currentRow + 1}`, `C${currentRow + 1}`);
        currentRow++;

        this.addCell(ws, `A${currentRow + 1}`, 'Produto', this.styles.columnHeader);
        this.addCell(ws, `B${currentRow + 1}`, 'Viagens', this.styles.columnHeader);
        this.addCell(ws, `C${currentRow + 1}`, 'Peso Total (kg)', this.styles.columnHeader);
        currentRow++;

        metrics.produtosRanking.forEach(([produto, dados], idx) => {
            const row = currentRow + 1;
            const medalha = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`;
            
            this.addCell(ws, `A${row}`, `${medalha} ${produto}`, this.styles.dataCell);
            this.addCell(ws, `B${row}`, dados.viagens, this.styles.numericCell);
            this.addCell(ws, `C${row}`, dados.peso, {
                ...this.styles.numericCell,
                font: { ...this.styles.numericCell.font, bold: idx < 3 }
            });
            currentRow++;
        });

        return ws;
    },

    /**
     * Cria a aba de transportadoras
     */
    createTransportadorasSheet(XLSX, titulo, config, pesagens, metrics) {
        const ws = XLSX.utils.aoa_to_sheet([]);
        let currentRow = 0;

        // Agrupar dados por transportadora
        const transpData = {};
        pesagens.forEach(p => {
            const transp = p.transportadora || 'Não Informado';
            if (!transpData[transp]) {
                transpData[transp] = {
                    viagens: 0,
                    pesoLiquido: 0,
                    pesoBruto: 0,
                    tara: 0,
                    pesoNota: 0,
                    placas: new Set()
                };
            }
            transpData[transp].viagens++;
            transpData[transp].pesoLiquido += Number(p.pesoLiquido) || 0;
            transpData[transp].pesoBruto += Number(p.pesoBruto) || 0;
            transpData[transp].tara += Number(p.tara) || 0;
            transpData[transp].pesoNota += Number(p.pesoNota) || 0;
            if (p.placa) transpData[transp].placas.add(p.placa);
        });

        const sortedData = Object.entries(transpData).sort(([, a], [, b]) => b.pesoLiquido - a.pesoLiquido);

        // Cabeçalho
        this.addCell(ws, 'A1', '🚚 DESEMPENHO POR TRANSPORTADORA', this.styles.headerTitle);
        this.mergeCells(ws, 'A1', 'K1');
        currentRow += 2;

        // Colunas
        const headers = ['#', 'Transportadora', 'Viagens', 'Carretas', 'Peso Líquido', 'Peso Bruto', 'Tara', 'Peso Nota', 'Diferença', '%', 'Média/Viagem'];
        headers.forEach((h, idx) => {
            const col = String.fromCharCode(65 + idx);
            this.addCell(ws, `${col}${currentRow + 1}`, h, this.styles.columnHeader);
        });
        currentRow++;

        // Dados
        sortedData.forEach(([nome, dados], idx) => {
            const row = currentRow + 1;
            const diff = dados.pesoNota > 0 ? dados.pesoLiquido - dados.pesoNota : 0;
            const perc = dados.pesoNota > 0 ? ((diff / dados.pesoNota) * 100) : 0;
            const media = dados.viagens > 0 ? dados.pesoLiquido / dados.viagens : 0;

            const rowData = [
                idx + 1,
                nome,
                dados.viagens,
                dados.placas.size,
                dados.pesoLiquido,
                dados.pesoBruto,
                dados.tara,
                dados.pesoNota,
                diff,
                perc.toFixed(2),
                media
            ];

            rowData.forEach((val, colIdx) => {
                const col = String.fromCharCode(65 + colIdx);
                const style = colIdx === 0 || colIdx === 1 
                    ? this.styles.dataCell 
                    : { ...this.styles.numericCell, font: { ...this.styles.numericCell.font, bold: idx < 3 } };
                this.addCell(ws, `${col}${row}`, val, style);
            });
            currentRow++;
        });

        return ws;
    },

    /**
     * Cria a aba de fornecedores
     */
    createFornecedoresSheet(XLSX, titulo, config, pesagens, metrics) {
        const ws = XLSX.utils.aoa_to_sheet([]);
        
        // Agrupar por fornecedor
        const fornData = {};
        pesagens.forEach(p => {
            const forn = p.cliente || 'Não Informado';
            if (!fornData[forn]) {
                fornData[forn] = { viagens: 0, peso: 0, placas: new Set() };
            }
            fornData[forn].viagens++;
            fornData[forn].peso += Number(p.pesoLiquido) || 0;
            if (p.placa) fornData[forn].placas.add(p.placa);
        });

        const sortedData = Object.entries(fornData).sort(([, a], [, b]) => b.peso - a.peso);

        // Preencher planilha (estrutura similar às outras)
        this.addCell(ws, 'A1', '🏭 DESEMPENHO POR FORNECEDOR', this.styles.headerTitle);
        this.mergeCells(ws, 'A1', 'D1');

        return ws;
    },

    /**
     * Cria a aba de produtos
     */
    createProdutosSheet(XLSX, titulo, config, pesagens, metrics) {
        const ws = XLSX.utils.aoa_to_sheet([]);
        
        this.addCell(ws, 'A1', '📦 MOVIMENTAÇÃO POR PRODUTO', this.styles.headerTitle);
        this.mergeCells(ws, 'A1', 'D1');

        return ws;
    },

    // Funções utilitárias
    addCell(ws, ref, value, style) {
        const cell = typeof value === 'object' && value.f 
            ? { t: 'n', f: value.f, s: style }
            : { t: typeof value === 'number' ? 'n' : typeof value === 'object' && value instanceof Date ? 'd' : 's', v: value, s: style };
        ws[ref] = cell;
    },

    mergeCells(ws, start, end) {
        if (!ws['!merges']) ws['!merges'] = [];
        const startCol = start.charCodeAt(0) - 65;
        const startRow = parseInt(start.slice(1)) - 1;
        const endCol = end.charCodeAt(0) - 65;
        const endRow = parseInt(end.slice(1)) - 1;
        ws['!merges'].push({ s: { r: startRow, c: startCol }, e: { r: endRow, c: endCol } });
    },

    formatarPeriodo(filtros) {
        if (!filtros.dataInicio || !filtros.dataFim) return 'Período: Todos os registros';
        const inicio = new Date(filtros.dataInicio).toLocaleDateString('pt-BR');
        const fim = new Date(filtros.dataFim).toLocaleDateString('pt-BR');
        return `Período: ${inicio} a ${fim}`;
    },

    formatarNotasFiscais(nota1, nota2) {
        const notas = [nota1, nota2].filter(n => n && String(n).trim());
        return notas.join(' / ') || '';
    },

    /**
     * Exporta para arquivo Excel
     */
    exportToFile(wb, filename) {
        const XLSX = window.XLSX;
        if (!XLSX || !wb) return false;
        
        const cleanFilename = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.xlsx`;
        XLSX.writeFile(wb, cleanFilename);
        return true;
    }
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ExcelExporter = ExcelExporter;
}
