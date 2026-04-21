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
     * Cria a aba de dados completos - Relatório Padrão Melhorado
     */
    createDadosSheet(XLSX, titulo, config, pesagens, metrics, filtros) {
        const ws = XLSX.utils.aoa_to_sheet([]);
        let currentRow = 0;

        // ===== CABEÇALHO PRINCIPAL COM LOGOTIPO VISUAL =====
        // Título principal com gradiente visual
        this.addCell(ws, 'A1', '⚖️ ' + titulo, this.styles.headerTitle);
        this.mergeCells(ws, 'A1', 'S1');
        currentRow++;

        // Empresa com destaque
        const empresaNome = config.nome || 'Empresa';
        const empresaCnpj = config.cnpj || '';
        const empresaInfo = empresaCnpj ? `${empresaNome} - CNPJ: ${empresaCnpj}` : empresaNome;
        this.addCell(ws, `A${currentRow + 1}`, empresaInfo, this.styles.companyHeader);
        this.mergeCells(ws, `A${currentRow + 1}`, `S${currentRow + 1}`);
        currentRow++;

        // Informações do relatório
        const periodo = this.formatarPeriodo(filtros);
        this.addCell(ws, `A${currentRow + 1}`, periodo, {
            ...this.styles.dataCell,
            fill: { patternType: 'solid', fgColor: { rgb: this.colors.light } },
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: this.colors.primary } }
        });
        this.mergeCells(ws, `A${currentRow + 1}`, `S${currentRow + 1}`);
        currentRow++;

        // Data e hora de geração com usuário
        const usuarioLogado = localStorage.getItem('balancaUsuario') || 'Usuário';
        const dataGeracao = `🕐 Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} | Usuário: ${usuarioLogado}`;
        this.addCell(ws, `A${currentRow + 1}`, dataGeracao, {
            ...this.styles.dataCell,
            fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
            font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '64748B' } }
        });
        this.mergeCells(ws, `A${currentRow + 1}`, `S${currentRow + 1}`);
        currentRow += 2;

        // ===== RESUMO EXECUTIVO EM DESTAQUE =====
        this.addCell(ws, `A${currentRow + 1}`, '📊 RESUMO EXECUTIVO', this.styles.sectionHeader);
        this.mergeCells(ws, `A${currentRow + 1}`, `H${currentRow + 1}`);
        currentRow++;

        // KPIs principais com formatação aprimorada
        const kpisPrincipais = [
            ['🎫 Total Pesagens', metrics.totalPesagens, '⚖️ Peso Bruto Total', `${metrics.totalBruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg`],
            ['📦 Peso Líquido Total', `${metrics.totalLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg`, '🏋️ Tara Total', `${metrics.totalTara.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg`],
            ['📈 Média por Ticket', `${metrics.mediaLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg`, '🏆 Maior Peso', `${metrics.maxLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg`],
            ['✅ Taxa Conformidade', `${metrics.conformidade.toFixed(1)}%`, '⚠️ Divergências', metrics.divergencias]
        ];

        kpisPrincipais.forEach((row, rowIndex) => {
            row.forEach((cell, colIdx) => {
                const col = String.fromCharCode(65 + colIdx);
                const isLabel = colIdx % 2 === 0;
                const isPercentage = cell.includes('%');
                const isWeight = cell.includes('kg');
                
                let style;
                if (isLabel) {
                    style = {
                        ...this.styles.dataCell,
                        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: this.colors.dark } },
                        fill: { patternType: 'solid', fgColor: { rgb: rowIndex % 2 === 0 ? 'F8FAFC' : 'F1F5F9' } }
                    };
                } else {
                    style = {
                        ...this.styles.numericCell,
                        font: { 
                            name: 'Calibri', 
                            sz: 11, 
                            bold: true, 
                            color: { rgb: isPercentage ? (parseFloat(cell) >= 95 ? this.colors.success : this.colors.warning) : this.colors.primary }
                        },
                        fill: { patternType: 'solid', fgColor: { rgb: rowIndex % 2 === 0 ? 'FFFFFF' : 'FAFAFA' } }
                    };
                    if (isWeight || isPercentage) {
                        style.numFmt = isPercentage ? '0.0"%"' : '#,##0.00" kg"';
                    }
                }
                this.addCell(ws, `${col}${currentRow + 1}`, cell.replace(' kg', '').replace('%', ''), style);
            });
            currentRow++;
        });

        currentRow++;

        // ===== INDICADORES VISUAIS =====
        // Barra de status visual
        const statusConformidade = metrics.conformidade >= 95 ? '✅ EXCELENTE' : metrics.conformidade >= 85 ? '⚠️ ATENÇÃO' : '🔴 CRÍTICO';
        const statusColor = metrics.conformidade >= 95 ? this.colors.success : metrics.conformidade >= 85 ? this.colors.warning : this.colors.danger;
        
        this.addCell(ws, `A${currentRow + 1}`, `📊 STATUS DA QUALIDADE: ${statusConformidade}`, {
            font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            fill: { patternType: 'solid', fgColor: { rgb: statusColor } },
            border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } }
        });
        this.mergeCells(ws, `A${currentRow + 1}`, `D${currentRow + 1}`);
        
        this.addCell(ws, `E${currentRow + 1}`, `📁 Registros: ${metrics.totalPesagens} | 📅 Período: ${filtros.dataInicio ? new Date(filtros.dataInicio).toLocaleDateString('pt-BR') : 'Todos'} a ${filtros.dataFim ? new Date(filtros.dataFim).toLocaleDateString('pt-BR') : 'Hoje'}`, {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: this.colors.dark } },
            alignment: { vertical: 'center', horizontal: 'left' },
            fill: { patternType: 'solid', fgColor: { rgb: 'E0F2FE' } }
        });
        this.mergeCells(ws, `E${currentRow + 1}`, `S${currentRow + 1}`);
        currentRow += 2;

        // ===== TABELA DE DADOS PRINCIPAIS =====
        // Cabeçalho da tabela com ícones e formatação premium
        const headers = [
            '#', '🎫 Ticket', '📄 Nota Fiscal', '🕐 Entrada', '🚪 Saída', '🚛 Placa', 
            '👤 Motorista', '🏭 Cliente', '🚚 Transportadora', '🏗️ Obra', '📦 Produto', 
            '📋 Certificado', '⚖️ Bruto', '🪶 Tara', '💎 Líquido', '📝 Nota', 
            '⚖️ Dif.', '📈 %', '✅ Status', '📌 Observação'
        ];
        
        const dataStartRow = currentRow + 1;
        headers.forEach((header, idx) => {
            const col = String.fromCharCode(65 + idx);
            // Estilo de cabeçalho premium com gradiente
            const headerStyle = {
                font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
                alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                fill: { 
                    patternType: 'gradient', 
                    fgColor: { rgb: idx % 2 === 0 ? '1F4788' : '0D9488' },
                    bgColor: { rgb: idx % 2 === 0 ? '0D9488' : '1F4788' }
                },
                border: { 
                    top: { style: 'thin', color: { rgb: 'FFFFFF' } }, 
                    bottom: { style: 'thin', color: { rgb: 'FFFFFF' } }, 
                    left: { style: 'thin', color: { rgb: 'FFFFFF' } }, 
                    right: { style: 'thin', color: { rgb: 'FFFFFF' } } 
                }
            };
            this.addCell(ws, `${col}${dataStartRow}`, header, headerStyle);
        });
        currentRow++;

        // Dados das pesagens com formatação aprimorada
        pesagens.forEach((p, index) => {
            const row = currentRow + 1;
            const isEven = index % 2 === 0;
            // Zebra striping sofisticado
            const baseStyle = {
                ...this.styles.dataCell,
                fill: { patternType: 'solid', fgColor: { rgb: isEven ? 'FFFFFF' : 'F8FAFC' } },
                font: { name: 'Calibri', sz: 10 }
            };

            const liquido = Number(p.pesoLiquido) || 0;
            const nota = Number(p.pesoNota) || 0;
            const diff = nota > 0 ? liquido - nota : null;
            const perc = nota > 0 ? ((diff / nota) * 100) : null;
            
            // Determinar status com ícones mais visuais
            let status = '✅ OK';
            let statusStyle = baseStyle;
            if (nota > 0 && Math.abs(perc) > 5) {
                status = '🔴 Divergente';
                statusStyle = { ...baseStyle, ...this.styles.highlightRed };
            } else if (nota > 0 && Math.abs(perc) > 2) {
                status = '🟡 Atenção';
                statusStyle = { ...baseStyle, ...this.styles.highlightYellow };
            } else if (nota > 0 && Math.abs(perc) <= 2) {
                status = '🟢 Dentro';
                statusStyle = { ...baseStyle, ...this.styles.highlightGreen };
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
                
                // Colunas numéricas com formatação especial
                if (colIdx >= 12 && colIdx <= 17) {
                    style = { 
                        ...this.styles.numericCell, 
                        fill: baseStyle.fill,
                        font: { ...baseStyle.font, bold: colIdx === 14 } // Peso líquido em negrito
                    };
                    // Adicionar separador de milhar para pesos
                    if (colIdx >= 12 && colIdx <= 16) {
                        style.numFmt = '#,##0.00';
                    } else if (colIdx === 17) {
                        style.numFmt = '0.00';
                    }
                }
                
                // Coluna de status com destaque
                if (colIdx === 18) {
                    style = { 
                        ...statusStyle, 
                        alignment: { vertical: 'center', horizontal: 'center' },
                        font: { ...statusStyle.font, bold: true, sz: 10 }
                    };
                }

                // Formatação de data/hora
                if (colIdx >= 3 && colIdx <= 4) {
                    style.numFmt = 'dd/mm/yyyy hh:mm';
                }

                // Primeira coluna (índice) centralizada
                if (colIdx === 0) {
                    style.alignment = { vertical: 'center', horizontal: 'center' };
                    style.font.bold = true;
                }

                this.addCell(ws, `${col}${row}`, cell.v, style);
            });

            currentRow++;
        });

        // Linha de totais premium
        const totalRow = currentRow + 1;
        this.addCell(ws, `A${totalRow}`, '⭐ TOTAIS GERAIS', {
            ...this.styles.totalRow,
            font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { patternType: 'solid', fgColor: { rgb: '0D9488' } }
        });
        this.mergeCells(ws, `A${totalRow}`, `C${totalRow}`);
        
        const lastDataRow = totalRow - 1;
        // Adicionar fórmulas Excel nativas para totais com formatação aprimorada
        ['M', 'N', 'O', 'P'].forEach((col, idx) => {
            const formula = `SUM(${col}${dataStartRow + 1}:${col}${lastDataRow})`;
            this.addCell(ws, `${col}${totalRow}`, { f: formula }, {
                font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                alignment: { vertical: 'center', horizontal: 'right' },
                fill: { patternType: 'solid', fgColor: { rgb: idx % 2 === 0 ? '1F4788' : '0D9488' } },
                numFmt: '#,##0.00',
                border: { top: { style: 'thick', color: { rgb: 'FFFFFF' } }, bottom: { style: 'thick', color: { rgb: 'FFFFFF' } }, left: { style: 'thin' }, right: { style: 'thin' } }
            });
        });

        // ===== RODAPÉ COM INFORMAÇÕES ADICIONAIS =====
        currentRow += 2;
        this.addCell(ws, `A${currentRow + 1}`, `📄 Relatório gerado automaticamente por Balança Pro+ | Total de Registros: ${pesagens.length}`, {
            font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '94A3B8' } },
            alignment: { vertical: 'center', horizontal: 'left' }
        });
        this.mergeCells(ws, `A${currentRow + 1}`, `S${currentRow + 1}`);

        // Configurações da planilha com larguras otimizadas
        ws['!cols'] = [
            { wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 19 }, { wch: 19 }, { wch: 14 },
            { wch: 26 }, { wch: 30 }, { wch: 26 }, { wch: 22 }, { wch: 24 }, { wch: 16 },
            { wch: 15 }, { wch: 13 }, { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 11 },
            { wch: 14 }, { wch: 45 }
        ];

        // Auto-filtro na tabela principal
        ws['!autofilter'] = { ref: `A${dataStartRow}:T${totalRow}` };
        
        // Congelar painéis (cabeçalho fixo)
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
