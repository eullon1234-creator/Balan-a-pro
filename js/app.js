        // Verificar carregamento de bibliotecas externas
        window.addEventListener('DOMContentLoaded', () => {
            const bibliotecas = {
                'jsPDF': typeof window.jspdf !== 'undefined',
                'Chart.js': typeof Chart !== 'undefined',
                'SheetJS': typeof XLSX !== 'undefined'
            };
            
            const falharam = Object.entries(bibliotecas)
                .filter(([nome, carregou]) => !carregou)
                .map(([nome]) => nome);
            
            if (falharam.length > 0) {
                console.warn('⚠️ Bibliotecas não carregadas:', falharam.join(', '));
            } else {
                console.log('✅ Todas as bibliotecas carregadas');
            }
        });
        
        // Firebase v11.6.1
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, onSnapshot, setDoc, addDoc, collection, deleteDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, getDoc, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const App = {
            state: { 
                fornecedores: [], 
                transportadoras: [],
                razoesSociais: [], 
                produtos: [], 
                obras: [], 
                pesagensPendentes: [], 
                pesagensCompletas: [], 
                config: { nome: 'Sua Empresa', cnpj: '', footer: '', color: '#0d9488', logo: '', password: '' }, 
                charts: { pesoProduto: null, pesagensDia: null }, 
                currentTicket: null, 
                ticketToEdit: null,
                ticketToDeleteId: null,
                pendingBackupData: null,
                ticketsCurrentPage: 1,
                reportsCurrentPage: 1,
                timelinePage: 1,
                itemsPerPage: 50,
                db: null, 
                auth: null,
                currentUser: null,
                userRole: null,
                userDoc: null,
                emailDono: null,
                userIdToChange: null,
                userId: null,
                isAdmin: false,
                isSubmittingEntrada: false,
                filtroFavorito: null,
                ultimoPeriodoSelecionado: null,
                programacaoDia: [],
                programacaoMeta: null,
                programacaoResumo: [],
                programacaoDataSelecionada: null,
                programacaoEditandoId: null,
                unsubscribeProgramacao: null,
                unsubscribeUserDoc: null,
                filtrosAvancados: {
                    horarioAtivo: null,
                    statusAtivo: null,
                },
                emailJS: {
                    publicKey: localStorage.getItem('emailjs_public_key') || '',
                    serviceId: localStorage.getItem('emailjs_service_id') || '',
                    templateId: localStorage.getItem('emailjs_template_id') || '',
                    configured: false
                },
                emailDestinatarios: [],
                // Sistema de Segurança
                security: {
                    loginAttempts: parseInt(localStorage.getItem('loginAttempts') || '0'),
                    lastAttemptTime: parseInt(localStorage.getItem('lastAttemptTime') || '0'),
                    lockedUntil: parseInt(localStorage.getItem('lockedUntil') || '0'),
                    sessionTimeout: 30 * 60 * 1000, // 30 minutos
                    lastActivity: Date.now(),
                    maxLoginAttempts: 5,
                    lockoutDuration: 15 * 60 * 1000 // 15 minutos
                },
                // Sistema de Cache
                cache: {
                    db: null,
                    enabled: true,
                    lastSync: null,
                    readsSaved: 0,
                    stats: {
                        hits: 0,
                        misses: 0,
                        size: 0,
                        itemCount: 0
                    }
                },
                // Contadores de leituras Firebase
                firebaseReads: {
                    pendentes: 0,
                    completas: 0,
                    total: 0
                }
            },
            
            async init() {
                console.log("🚀 Iniciando aplicação...");
                
                this.cacheDOMElements();
                this.bindEvents();
                
                // Mostrar tela de autenticação imediatamente
                this.showAuthScreen();
                
                await this.firebaseSetup();
                // attachFirestoreListeners() será chamado apenas após autenticação
                this.updateUIAccess();
            },

            async firebaseSetup() {
                const firebaseConfig = {
                    apiKey: "AIzaSyA_KGZ4vIqYqDnAsnXX4NCq0t_zf7_Unas",
                    authDomain: "balanca-pro.firebaseapp.com",
                    projectId: "balanca-pro",
                    storageBucket: "balanca-pro.firebasestorage.app",
                    messagingSenderId: "590432035547",
                    appId: "1:590432035547:web:3fd5de471db482529b22fe",
                    measurementId: "G-TXB7KFYGHG"
                };
                
                try {
                    const app = initializeApp(firebaseConfig);
                    this.state.db = getFirestore(app);
                    this.state.auth = getAuth(app);

                    // Listener de autenticação
                    onAuthStateChanged(this.state.auth, async (user) => {
                        if (user) {
                            console.log("✅ Usuário autenticado:", user.email);
                            await this.handleUserAuthenticated(user);
                        } else {
                            console.log("❌ Usuário não autenticado");
                            this.showAuthScreen();
                        }
                    });
                    
                    console.log("✅ Firebase inicializado com sucesso");
                    
                } catch (error) {
                    console.error("❌ Erro ao inicializar Firebase:", error);
                    
                    if (error.code === 'auth/network-request-failed') {
                        alert('❌ Erro de conexão!\n\nVerifique sua internet e tente novamente.');
                    } else if (error.code === 'auth/invalid-api-key') {
                        alert('❌ Configuração do Firebase inválida!\n\nEntre em contato com o administrador.');
                    } else if (error.message?.includes('quota') || error.message?.includes('exceeded')) {
                        alert('⚠️ Cota do Firebase esgotada!\n\n' +
                              'O sistema está temporariamente indisponível.\n' +
                              'Aguarde a renovação ou upgrade do plano.');
                    } else {
                        alert(`❌ Erro ao conectar ao Firebase:\n${error.message}\n\nRecarregue a página ou entre em contato com suporte.`);
                    }
                    
                    this.showAuthScreen();
                }

                // Persistência offline habilitada automaticamente no Firebase 11.x
                // A API enableIndexedDbPersistence() foi deprecada
                // Use FirestoreSettings.cache se necessário configuração customizada
                console.log("✅ Persistência offline habilitada automaticamente (Firebase 11.x)");

                // Não fazer login anônimo - esperar login com email
                this.bindAuthEvents();
                
                // Inicializar cache híbrido
                this.initCache();
            },

            // ==================== SISTEMA DE CACHE HÍBRIDO ====================
            async initCache() {
                if (!this.state.cache.enabled) return;
                
                try {
                    const request = indexedDB.open('BalancaProCache', 1);
                    
                    request.onerror = () => {
                        console.warn('⚠️ IndexedDB não disponível, cache desabilitado');
                        this.state.cache.enabled = false;
                    };
                    
                    request.onsuccess = (event) => {
                        this.state.cache.db = event.target.result;
                        console.log('✅ Cache híbrido inicializado');
                        this.updateCacheBadge();
                    };
                    
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        
                        // Store para pesagens
                        if (!db.objectStoreNames.contains('pesagens')) {
                            const pesagensStore = db.createObjectStore('pesagens', { keyPath: 'id' });
                            pesagensStore.createIndex('timestamp', 'cachedAt', { unique: false });
                        }
                        
                        // Store para cadastros (fornecedores, transportadoras, produtos)
                        if (!db.objectStoreNames.contains('cadastros')) {
                            const cadastrosStore = db.createObjectStore('cadastros', { keyPath: 'type' });
                            cadastrosStore.createIndex('timestamp', 'cachedAt', { unique: false });
                        }
                        
                        // Store para config
                        if (!db.objectStoreNames.contains('config')) {
                            const configStore = db.createObjectStore('config', { keyPath: 'id' });
                            configStore.createIndex('timestamp', 'cachedAt', { unique: false });
                        }
                        
                        console.log('💾 Stores IndexedDB criadas');
                    };
                } catch (error) {
                    console.error('❌ Erro ao inicializar cache:', error);
                    this.state.cache.enabled = false;
                }
            },

            async getFromCache(store, key) {
                if (!this.state.cache.enabled || !this.state.cache.db) return null;
                
                try {
                    const transaction = this.state.cache.db.transaction([store], 'readonly');
                    const objectStore = transaction.objectStore(store);
                    const request = objectStore.get(key);
                    
                    return new Promise((resolve, reject) => {
                        request.onsuccess = () => {
                            const data = request.result;
                            
                            if (data) {
                                // Verificar se não está muito antigo (30 dias)
                                const age = Date.now() - data.cachedAt;
                                const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
                                
                                if (age > maxAge) {
                                    this.removeFromCache(store, key);
                                    this.state.cache.stats.misses++;
                                    resolve(null);
                                } else {
                                    this.state.cache.stats.hits++;
                                    resolve(data.content);
                                }
                            } else {
                                this.state.cache.stats.misses++;
                                resolve(null);
                            }
                        };
                        
                        request.onerror = () => {
                            this.state.cache.stats.misses++;
                            resolve(null);
                        };
                    });
                } catch (error) {
                    console.error('❌ Erro ao ler cache:', error);
                    this.state.cache.stats.misses++;
                    return null;
                }
            },

            async saveToCache(store, key, content) {
                if (!this.state.cache.enabled || !this.state.cache.db) return;
                
                try {
                    const transaction = this.state.cache.db.transaction([store], 'readwrite');
                    const objectStore = transaction.objectStore(store);
                    
                    const data = {
                        id: key,
                        type: key, // Para cadastros store
                        content: content,
                        cachedAt: Date.now()
                    };
                    
                    objectStore.put(data);
                    this.state.cache.lastSync = new Date().toISOString();
                    await this.updateCacheStats();
                    this.updateCacheBadge();
                } catch (error) {
                    console.error('❌ Erro ao salvar no cache:', error);
                }
            },

            async removeFromCache(store, key) {
                if (!this.state.cache.enabled || !this.state.cache.db) return;
                
                try {
                    const transaction = this.state.cache.db.transaction([store], 'readwrite');
                    const objectStore = transaction.objectStore(store);
                    objectStore.delete(key);
                } catch (error) {
                    console.error('❌ Erro ao remover do cache:', error);
                }
            },

            async clearCache(store = null) {
                if (!this.state.cache.enabled || !this.state.cache.db) return;
                
                try {
                    const stores = store ? [store] : ['pesagens', 'cadastros', 'config'];
                    
                    for (const storeName of stores) {
                        const transaction = this.state.cache.db.transaction([storeName], 'readwrite');
                        const objectStore = transaction.objectStore(storeName);
                        objectStore.clear();
                    }
                    
                    this.state.cache.stats = { hits: 0, misses: 0, size: 0, itemCount: 0 };
                    this.state.cache.lastSync = null;
                    this.updateCacheBadge();
                    
                    console.log('🧹 Cache limpo');
                } catch (error) {
                    console.error('❌ Erro ao limpar cache:', error);
                }
            },

            async updateCacheStats() {
                if (!this.state.cache.enabled || !this.state.cache.db) return;
                
                try {
                    let totalSize = 0;
                    let totalCount = 0;
                    
                    const stores = ['pesagens', 'cadastros', 'config'];
                    
                    for (const storeName of stores) {
                        const transaction = this.state.cache.db.transaction([storeName], 'readonly');
                        const objectStore = transaction.objectStore(storeName);
                        const countRequest = objectStore.count();
                        
                        await new Promise((resolve) => {
                            countRequest.onsuccess = () => {
                                const count = countRequest.result;
                                totalCount += count;
                                
                                // Estimar tamanho (aproximado)
                                const sizeEstimate = count * 2; // ~2KB por item (média)
                                totalSize += sizeEstimate;
                                
                                resolve();
                            };
                        });
                    }
                    
                    this.state.cache.stats.size = totalSize;
                    this.state.cache.stats.itemCount = totalCount;
                } catch (error) {
                    console.error('❌ Erro ao atualizar stats do cache:', error);
                }
            },

            updateCacheBadge() {
                const badge = document.getElementById('cache-badge');
                if (!badge) return;
                
                if (this.state.cache.enabled && this.state.cache.stats.itemCount > 0) {
                    badge.classList.remove('hidden');
                    badge.title = `${this.state.cache.stats.itemCount} itens em cache`;
                } else {
                    badge.classList.add('hidden');
                }
            },

            mostrarEstatisticasCache() {
                const stats = this.state.cache.stats;
                const total = stats.hits + stats.misses;
                const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : 0;
                const economia = total > 0 ? stats.hits : 0;
                
                const lastSync = this.state.cache.lastSync 
                    ? new Date(this.state.cache.lastSync).toLocaleString('pt-BR')
                    : 'Nunca';
                
                const html = `
                    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick="this.remove()">
                        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" onclick="event.stopPropagation()">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="text-3xl">💾</div>
                                <h3 class="text-xl font-bold text-gray-800">Estatísticas do Cache</h3>
                            </div>
                            
                            <div class="space-y-3">
                                <div class="bg-teal-50 rounded-lg p-3">
                                    <div class="text-sm text-teal-700 font-medium">Taxa de Acerto</div>
                                    <div class="text-2xl font-bold text-teal-600">${hitRate}%</div>
                                    <div class="text-xs text-teal-600">${stats.hits} acertos de ${total} tentativas</div>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="bg-blue-50 rounded-lg p-3">
                                        <div class="text-sm text-blue-700 font-medium">Itens</div>
                                        <div class="text-xl font-bold text-blue-600">${stats.itemCount}</div>
                                    </div>
                                    
                                    <div class="bg-purple-50 rounded-lg p-3">
                                        <div class="text-sm text-purple-700 font-medium">Tamanho</div>
                                        <div class="text-xl font-bold text-purple-600">${stats.size} KB</div>
                                    </div>
                                </div>
                                
                                <div class="bg-green-50 rounded-lg p-3">
                                    <div class="text-sm text-green-700 font-medium">Economia Firebase</div>
                                    <div class="text-xl font-bold text-green-600">${economia} leituras</div>
                                    <div class="text-xs text-green-600">Evitadas pelo cache</div>
                                </div>
                                
                                <div class="bg-gray-50 rounded-lg p-3">
                                    <div class="text-sm text-gray-700 font-medium">Última Sincronização</div>
                                    <div class="text-sm font-semibold text-gray-800">${lastSync}</div>
                                </div>
                            </div>
                            
                            <div class="mt-4 flex gap-2">
                                <button 
                                    onclick="App.clearCache(); this.closest('div[class*=fixed]').remove(); alert('Cache limpo com sucesso!');"
                                    class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium">
                                    🧹 Limpar Cache
                                </button>
                                <button 
                                    onclick="this.closest('div[class*=fixed]').remove()"
                                    class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.insertAdjacentHTML('beforeend', html);
            },
            // ==================== FIM DO SISTEMA DE CACHE ====================

            attachFirestoreListeners() {
                const db = this.state.db;
                
                // *** LISTENER CONFIG COM CACHE *** (Mantém como está - é um documento único)
                const configRef = doc(db, 'app_state', 'config');
                
                // Tentar carregar do cache primeiro
                this.getFromCache('config', 'config').then(cachedConfig => {
                    if (cachedConfig) {
                        console.log('📦 Config carregado do cache');
                        const defaultConfig = { nome: 'Sua Empresa', cnpj: '', footer: '', color: '#0d9488', logo: '', password: '' };
                        this.state.config = { ...defaultConfig, ...cachedConfig };
                        this.renderConfig();
                        this.renderFooter();
                        if (!this.state.config.password) {
                            this.state.isAdmin = true;
                            this.updateUIAccess();
                        }
                    }
                });
                
                onSnapshot(configRef, (docSnap) => {
                    if (docSnap.metadata.fromCache) {
                        this.updateConnectionStatus('offline');
                    } else {
                        this.updateConnectionStatus('online');
                    }

                    const defaultConfig = { nome: 'Sua Empresa', cnpj: '', footer: '', color: '#0d9488', logo: '', password: '' };
                    if (docSnap.exists()) {
                        const configData = docSnap.data();
                        this.state.config = { ...defaultConfig, ...configData };
                        
                        // Salvar no cache
                        this.saveToCache('config', 'config', configData);
                    } else {
                        this.state.config = defaultConfig;
                    }
                    this.renderConfig();
                    this.renderFooter();
                    if (!this.state.config.password) {
                        this.state.isAdmin = true;
                        this.updateUIAccess();
                    }
                }, (error) => {
                    console.error("❌ Erro no listener de config:", error);
                    // Em caso de erro, tentar usar cache
                    this.getFromCache('config', 'config').then(cachedConfig => {
                        if (cachedConfig) {
                            console.log('🔄 Usando config do cache após erro');
                            const defaultConfig = { nome: 'Sua Empresa', cnpj: '', footer: '', color: '#0d9488', logo: '', password: '' };
                            this.state.config = { ...defaultConfig, ...cachedConfig };
                            this.renderConfig();
                            this.renderFooter();
                        }
                    });
                });

                // *** LISTENER CADASTROS COM CACHE *** (Mantém como está - é um documento único)
                const cadastrosRef = doc(db, 'app_state', 'cadastros');
                
                // Tentar carregar do cache primeiro
                this.getFromCache('cadastros', 'cadastros').then(cachedCadastros => {
                    if (cachedCadastros) {
                        console.log('📦 Cadastros carregados do cache');
                        this.state.fornecedores = cachedCadastros.fornecedores || [];
                        this.state.transportadoras = cachedCadastros.transportadoras || [];
                        this.state.produtos = cachedCadastros.produtos || [];
                        this.state.obras = cachedCadastros.obras || [];
                        this.renderFornecedores();
                        this.renderTransportadoras();
                        this.renderProdutos();
                        this.renderObras();
                    }
                });
                
                onSnapshot(cadastrosRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        this.state.fornecedores = data.fornecedores || [];
                        this.state.transportadoras = data.transportadoras || [];
                        this.state.razoesSociais = data.razoesSociais || [];
                        this.state.produtos = data.produtos || [];
                        this.state.obras = data.obras || [];
                        
                        // Salvar no cache
                        this.saveToCache('cadastros', 'cadastros', data);
                    } else {
                        this.state.fornecedores = [];
                        this.state.transportadoras = [];
                        this.state.razoesSociais = [];
                        this.state.produtos = [];
                        this.state.obras = [];
                    }
                    this.renderFornecedores();
                    this.renderTransportadoras();
                    this.renderRazoesSociais();
                    this.renderProdutos();
                    this.renderObras();
                }, (error) => {
                    console.error("❌ Erro no listener de cadastros:", error);
                    // Em caso de erro, tentar usar cache
                    this.getFromCache('cadastros', 'cadastros').then(cachedCadastros => {
                        if (cachedCadastros) {
                            console.log('🔄 Usando cadastros do cache após erro');
                            this.state.fornecedores = cachedCadastros.fornecedores || [];
                            this.state.transportadoras = cachedCadastros.transportadoras || [];
                            this.state.razoesSociais = cachedCadastros.razoesSociais || [];
                            this.state.produtos = cachedCadastros.produtos || [];
                            this.state.obras = cachedCadastros.obras || [];
                            this.renderFornecedores();
                            this.renderTransportadoras();
                            this.renderRazoesSociais();
                            this.renderProdutos();
                            this.renderObras();
                        }
                    });
                });
                
                // *** LISTENER PESAGENS PENDENTES - OTIMIZADO COM docChanges() ***
                const pendentesRef = collection(db, 'pesagensPendentes');
                let pendentesFirstLoad = true; // Flag para primeira carga
                
                // Tentar carregar do cache primeiro
                this.getFromCache('pesagens', 'pendentes').then(cachedPendentes => {
                    if (cachedPendentes) {
                        console.log('📦 Pesagens pendentes carregadas do cache');
                        this.state.pesagensPendentes = cachedPendentes;
                        this.renderPendentes();
                        this.renderProgramacaoDia();
                    }
                });
                
                onSnapshot(pendentesRef, (snapshot) => {
                    // ✅ PROTEÇÃO 1: Na primeira carga, carregar tudo normalmente
                    if (pendentesFirstLoad) {
                        console.log('🔄 Primeira carga - carregando todas as pendentes (' + snapshot.docs.length + ' documentos)');
                        this.state.pesagensPendentes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        pendentesFirstLoad = false;
                        
                        // Atualizar contador de leituras
                        this.state.firebaseReads.pendentes += snapshot.docs.length;
                    } else {
                        // ✅ PROTEÇÃO 2: Usar docChanges() apenas após primeira carga
                        const changes = snapshot.docChanges();
                        console.log(`⚡ Update incremental - ${changes.length} mudanças detectadas`);
                        
                        changes.forEach((change) => {
                            const itemData = { id: change.doc.id, ...change.doc.data() };
                            
                            if (change.type === 'added') {
                                // ✅ PROTEÇÃO 3: Verificar se não é duplicado antes de adicionar
                                const exists = this.state.pesagensPendentes.some(p => p.id === itemData.id);
                                if (!exists) {
                                    this.state.pesagensPendentes.push(itemData);
                                    console.log(`➕ Pesagem pendente adicionada: ${itemData.id}`);
                                }
                                this.state.firebaseReads.pendentes += 1;
                            }
                            
                            if (change.type === 'modified') {
                                const index = this.state.pesagensPendentes.findIndex(p => p.id === itemData.id);
                                if (index !== -1) {
                                    this.state.pesagensPendentes[index] = itemData;
                                    console.log(`✏️ Pesagem pendente modificada: ${itemData.id}`);
                                }
                                this.state.firebaseReads.pendentes += 1;
                            }
                            
                            if (change.type === 'removed') {
                                this.state.pesagensPendentes = this.state.pesagensPendentes.filter(p => p.id !== itemData.id);
                                console.log(`🗑️ Pesagem pendente removida: ${itemData.id}`);
                                this.state.firebaseReads.pendentes += 1;
                            }
                        });
                        
                        // ✅ Economia: Leu apenas as mudanças (não todas)
                        const economiaReads = snapshot.docs.length - changes.length;
                        if (economiaReads > 0) {
                            this.state.cache.readsSaved += economiaReads;
                            console.log(`💰 Economia: ${economiaReads} reads evitados!`);
                        }
                    }
                    
                    // Salvar no cache
                    this.saveToCache('pesagens', 'pendentes', this.state.pesagensPendentes);
                    
                    this.renderPendentes();
                    this.renderProgramacaoDia();
                }, (error) => {
                    console.error("❌ Erro no listener de pendentes:", error);
                    // Em caso de erro, tentar usar cache
                    this.getFromCache('pesagens', 'pendentes').then(cachedPendentes => {
                        if (cachedPendentes) {
                            console.log('🔄 Usando pesagens pendentes do cache após erro');
                            this.state.pesagensPendentes = cachedPendentes;
                            this.renderPendentes();
                            this.renderProgramacaoDia();
                        }
                    });
                });

                // *** LISTENER PESAGENS COMPLETAS - OTIMIZADO COM docChanges() ***
                const completasRef = collection(db, 'pesagensCompletas');
                let completasFirstLoad = true; // Flag para primeira carga
                
                // Tentar carregar do cache primeiro
                this.getFromCache('pesagens', 'completas').then(cachedCompletas => {
                    if (cachedCompletas) {
                        console.log('📦 Pesagens completas carregadas do cache');
                        this.state.pesagensCompletas = cachedCompletas;
                        this.renderRelatorios();
                        this.renderTickets();
                        this.renderDashboard();
                        this.renderProgramacaoDia();
                    }
                });
                
                onSnapshot(completasRef, (snapshot) => {
                    // ✅ PROTEÇÃO 1: Na primeira carga, carregar tudo normalmente
                    if (completasFirstLoad) {
                        console.log('🔄 Primeira carga - carregando todas as completas (' + snapshot.docs.length + ' documentos)');
                        this.state.pesagensCompletas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        completasFirstLoad = false;
                        
                        // Atualizar contador de leituras
                        this.state.firebaseReads.completas += snapshot.docs.length;
                    } else {
                        // ✅ PROTEÇÃO 2: Usar docChanges() apenas após primeira carga
                        const changes = snapshot.docChanges();
                        console.log(`⚡ Update incremental - ${changes.length} mudanças detectadas`);
                        
                        changes.forEach((change) => {
                            const itemData = { id: change.doc.id, ...change.doc.data() };
                            
                            if (change.type === 'added') {
                                // ✅ PROTEÇÃO 3: Verificar se não é duplicado antes de adicionar
                                const exists = this.state.pesagensCompletas.some(p => p.id === itemData.id);
                                if (!exists) {
                                    this.state.pesagensCompletas.push(itemData);
                                    console.log(`➕ Pesagem completa adicionada: ${itemData.id}`);
                                }
                                this.state.firebaseReads.completas += 1;
                            }
                            
                            if (change.type === 'modified') {
                                const index = this.state.pesagensCompletas.findIndex(p => p.id === itemData.id);
                                if (index !== -1) {
                                    this.state.pesagensCompletas[index] = itemData;
                                    console.log(`✏️ Pesagem completa modificada: ${itemData.id}`);
                                }
                                this.state.firebaseReads.completas += 1;
                            }
                            
                            if (change.type === 'removed') {
                                this.state.pesagensCompletas = this.state.pesagensCompletas.filter(p => p.id !== itemData.id);
                                console.log(`🗑️ Pesagem completa removida: ${itemData.id}`);
                                this.state.firebaseReads.completas += 1;
                            }
                        });
                        
                        // ✅ Economia: Leu apenas as mudanças (não todas)
                        const economiaReads = snapshot.docs.length - changes.length;
                        if (economiaReads > 0) {
                            this.state.cache.readsSaved += economiaReads;
                            console.log(`💰 Economia: ${economiaReads} reads evitados!`);
                        }
                    }
                    
                    // Salvar no cache
                    this.saveToCache('pesagens', 'completas', this.state.pesagensCompletas);
                    
                    this.renderRelatorios();
                    this.renderTickets();
                    this.renderDashboard();
                    this.renderProgramacaoDia();
                }, (error) => {
                    console.error("❌ Erro no listener de completas:", error);
                    // Em caso de erro, tentar usar cache
                    this.getFromCache('pesagens', 'completas').then(cachedCompletas => {
                        if (cachedCompletas) {
                            console.log('🔄 Usando pesagens completas do cache após erro');
                            this.state.pesagensCompletas = cachedCompletas;
                            this.renderRelatorios();
                            this.renderTickets();
                            this.renderDashboard();
                            this.renderProgramacaoDia();
                        }
                    });
                });

                document.getElementById('loading-overlay').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('loading-overlay').style.display = 'none';
                    document.getElementById('app-container').style.opacity = '1';
                }, 300);
            },
            
            // O restante do código permanece o mesmo...
            cacheDOMElements() {
                const get = (id) => document.getElementById(id);
                this.dom = {
                    body: document.body,
                    tabButtons: document.querySelectorAll('.tab-button'),
                    tabContents: document.querySelectorAll('.tab-content'),
                    headerNomeEmpresa: get('header-nome-empresa'), footer: get('app-footer'),
                    headerLogoContainer: get('header-logo-container'), headerLogo: get('header-logo'), headerDefaultIcon: get('header-default-icon'),
                    
                    connectionStatus: get('connection-status'),
                    statusDot: get('status-dot'),
                    statusText: get('status-text'),

                    programacaoCard: get('programacao-dia-card'),
                    programacaoLista: get('programacao-dia-lista'),
                    programacaoDataInput: get('programacao-dia-data'),
                    programacaoDataLabel: get('programacao-dia-data-label'),
                    programacaoMetaLabel: get('programacao-dia-meta'),
                    programacaoSemPermissao: get('programacao-dia-sem-permissao'),
                    btnProgramacaoAdd: get('btn-programacao-add'),
                    modalProgramacao: get('modal-programacao'),
                    formProgramacao: get('form-programacao'),
                    programacaoModalTitle: get('programacao-modal-title'),
                    programacaoDataModal: get('programacao-data-modal'),
                    programacaoProduto: get('programacao-produto'),
                    programacaoDestino: get('programacao-destino'),
                    programacaoQuantidade: get('programacao-quantidade'),
                    programacaoUnidade: get('programacao-unidade'),
                    programacaoObservacao: get('programacao-observacao'),
                    btnCancelProgramacao: get('btn-cancel-programacao'),
                    btnCloseProgramacao: get('btn-close-programacao'),

                    modalAdminLogin: get('modal-admin-login'), formAdminLogin: get('form-admin-login'), adminPasswordInput: get('admin-password'), btnCancelLogin: get('btn-cancel-login'), loginErrorMsg: get('login-error-msg'),
                    btnAdminLogin: get('btn-admin-login'), btnAdminLogout: get('btn-admin-logout'),
                    
                    modalConfig: get('modal-config'), btnToggleConfig: get('btn-toggle-config'), btnFecharConfig: get('btn-fechar-config'),
                    configNomeInput: get('config-nome-empresa'), configCnpjInput: get('config-cnpj'), configFooterInput: get('config-footer'), configPasswordInput: get('config-password'),
                    configColorInput: get('config-color'), configLogoUpload: get('config-logo-upload'),
                    logoPreviewContainer: get('logo-preview-container'), logoPreview: get('logo-preview'), btnRemoveLogo: get('btn-remove-logo'),
                    btnExportarBackup: get('btn-exportar-backup'),
                    
                    btnInfoDev: get('btn-info-dev'),
                    modalInfoDev: get('modal-info-dev'),
                    btnCloseInfoDev: get('btn-close-info-dev'),
                    btnImportarBackup: get('btn-importar-backup'), backupFileInput: get('backup-file-input'),

                    modalConfirmRestore: get('modal-confirm-restore'),
                    restoreConfirmInput: get('restore-confirm-input'),
                    btnCancelRestore: get('btn-cancel-restore'),
                    btnConfirmRestore: get('btn-confirm-restore'),
                    
                    formFornecedor: get('form-fornecedor'), tabelaFornecedores: get('tabela-fornecedores'),
                    formTransportadora: get('form-transportadora'), tabelaTransportadoras: get('tabela-transportadoras'),
                    formRazaoSocial: get('form-razao-social'), tabelaRazoesSociais: get('tabela-razoes-sociais'),
                    formObra: get('form-obra'), tabelaObras: get('tabela-obras'),
                    formProduto: get('form-produto'), tabelaProdutos: get('tabela-produtos'), certificadoProdutoInput: get('certificado-produto'),
                    formEntrada: get('form-entrada'),
                    checkPesagemDupla: get('check-pesagem-dupla'),
                    containerPeso1Eixo2: get('container-peso1-eixo2'),
                    entradaNf2Container: get('container-nf2'),
                    entrada: { 
                        placa: get('entrada-placa'), motorista: get('entrada-motorista'), nf: get('entrada-nf'), nf2: get('entrada-nf2'), hasNf2: get('entrada-has-nf2'),
                        pesoNota: get('entrada-peso-nota'),
                        produto: get('entrada-produto'), cliente: get('entrada-cliente'), transportadora: get('entrada-transportadora'), razaoSocial: get('entrada-razao-social'), obra: get('entrada-obra'), 
                        peso1eixo1: get('entrada-peso1-eixo1'), peso1eixo2: get('entrada-peso1-eixo2'),
                        observacao: get('entrada-observacao')
                    },
                    programacaoSugestoesContainer: get('entrada-programacao-sugestoes'),
                    programacaoSugestoesLista: get('entrada-programacao-sugestoes-lista'),
                    programacaoSugestoesTitulo: get('entrada-programacao-sugestoes-titulo'),
                    btnProgramacaoSugestoesRefresh: get('btn-programacao-sugestoes-refresh'),
                    saidaPesquisaPlaca: get('saida-pesquisa-placa'), 
                    saidaFiltroData: get('saida-filtro-data'),
                    saidaFiltroFornecedor: get('saida-filtro-fornecedor'),
                    saidaFiltroProduto: get('saida-filtro-produto'),
                    btnLimparFiltrosSaida: get('btn-limpar-filtros-saida'),
                    listaPendentes: get('lista-pendentes'),
                    visualizadorPesquisaPlaca: get('visualizador-pesquisa-placa'), visualizadorOrdenacao: get('visualizador-ordenacao'), visualizadorListaPendentes: get('visualizador-lista-pendentes'), visualizadorResumoTotal: get('visualizador-resumo-total'),
                    formSaidaContainer: get('form-saida-container'), formSaida: get('form-saida'),
                    tabelaTickets: get('tabela-tickets'),
                    ticketsPagination: get('tickets-pagination'),
                    modalTicket: get('modal-ticket'), btnFecharTicket: get('btn-fechar-ticket'), btnImprimir: get('btn-imprimir'), btnBaixarTicketPdf: get('btn-baixar-ticket-pdf'), ticketContainer: get('ticket-imprimivel-container'), selectTicketSize: get('select-ticket-size'),
                    
                    modalEditTicket: get('modal-edit-ticket'), formEditTicket: get('form-edit-ticket'),
                    
                    modalConfirmDelete: get('modal-confirm-delete'), btnConfirmDelete: get('btn-confirm-delete'), btnCancelDelete: get('btn-cancel-delete'),
                    modalNotification: get('modal-notification'), notificationMessage: get('notification-message'),
                    
                    relatorioSummary: get('relatorio-summary'), relatorioTotalLiquido: get('relatorio-total-liquido'), relatorioTotalTickets: get('relatorio-total-tickets'),
                    relatorioInsights: get('relatorio-insights'), relatorioTotalBruto: get('relatorio-total-bruto'), relatorioTotalTara: get('relatorio-total-tara'), relatorioMediaLiquido: get('relatorio-media-liquido'), relatorioTopTransportadora: get('relatorio-top-transportadora'),
                    relatorioAgrupamentos: get('relatorio-agrupamentos'), relatorioTransportadoraBody: get('relatorio-transportadora-body'),
                    relatorioPeriodoText: get('relatorio-periodo-text'),
                    relatorioDivergencias: get('relatorio-divergencias'), relatorioDivergenciasLista: get('relatorio-divergencias-lista'),
                    
                    tabelaRelatorios: get('tabela-relatorios'),
                    relatoriosPagination: get('relatorios-pagination'),
                    filtroPesquisaInput: get('filtro-pesquisa'), filtroProduto: get('filtro-produto'), filtroFornecedor: get('filtro-fornecedor'), filtroTransportadora: get('filtro-transportadora'), filtroCertificado: get('filtro-certificado'), filtroObra: get('filtro-obra'),
                    filtroMotorista: get('filtro-motorista'), // NOVO FILTRO
                    filtroDataInicio: get('filtro-data-inicio'), filtroDataFim: get('filtro-data-fim'),
                    relatorioTitulo: get('relatorio-titulo'),
                    // Filtros Avançados
                    filtroPesoMin: get('filtro-peso-min'),
                    filtroPesoMax: get('filtro-peso-max'),
                    filtroHoraInicio: get('filtro-hora-inicio'),
                    filtroHoraFim: get('filtro-hora-fim'),
                    filtroCampo1: get('filtro-campo1'),
                    filtroOperador1: get('filtro-operador1'),
                    filtroValor1: get('filtro-valor1'),
                    filtroLogico: get('filtro-logico'),
                    filtroCampo2: get('filtro-campo2'),
                    filtroOperador2: get('filtro-operador2'),
                    filtroValor2: get('filtro-valor2'),
                    btnToggleFiltrosAvancados: get('btn-toggle-filtros-avancados'),
                    filtrosAvancadosContent: get('filtros-avancados-content'),
                    btnLimparFiltrosAvancados: get('btn-limpar-filtros-avancados'),
                    filtrosAtivosBadge: get('filtros-ativos-badge'), 
                    btnExportPdf: get('btn-export-pdf'), btnExportExcel: get('btn-export-excel'),
                    btnImportExcel: get('btn-import-excel'), importExcelInput: get('import-excel-input'),
                    btnExportAgregado: get('btn-export-agregado'),
                    btnExportDivergencias: get('btn-export-divergencias'),
                    btnSalvarFiltroFavorito: get('btn-salvar-filtro-favorito'),
                    btnCarregarFiltroFavorito: get('btn-carregar-filtro-favorito'),
                    btnExportPdfToggle: get('btn-export-pdf-toggle'),
                    btnExportExcelToggle: get('btn-export-excel-toggle'),
                    
                    filtroTicketDataInicio: get('filtro-ticket-data-inicio'), filtroTicketDataFim: get('filtro-ticket-data-fim'), filtroTicketProduto: get('filtro-ticket-produto'), filtroTicketPesquisa: get('filtro-ticket-pesquisa'), btnLimparFiltrosTicket: get('btn-limpar-filtros-ticket'),
                    filtroTicketObra: get('filtro-ticket-obra'), // NOVO FILTRO
                    filtroTicketCliente: get('filtro-ticket-cliente'), // NOVO FILTRO
                    filtroTicketTransportadora: get('filtro-ticket-transportadora'),

                    dbFiltroFornecedor: get('db-filtro-fornecedor'), dbFiltroProduto: get('db-filtro-produto'), dbFiltroTransportadora: get('db-filtro-transportadora'), btnDbLimparFiltros: get('btn-db-limpar-filtros'),
                    dbStatPesagensHoje: get('db-stat-pesagens-hoje'), dbStatPesoHoje: get('db-stat-peso-hoje'), dbStatVeiculosPatio: get('db-stat-veiculos-patio'), dbStatTicketMedio: get('db-stat-ticket-medio'),
                    dashboardUltimasPesagens: get('dashboard-ultimas-pesagens'),
                    dashboardTopProdutos: get('dashboard-top-produtos'),
                    
                    chartPesoProduto: get('chart-peso-produto'), chartPesagensDia: get('chart-pesagens-dia'),
                    
                    // Auth elements
                    authScreen: get('auth-screen'),
                    formLogin: get('form-login'),
                    formRegister: get('form-register'),
                    btnShowRegister: get('btn-show-register'),
                    btnBackToLogin: get('btn-back-to-login'),
                    btnLogout: get('btn-logout'),
                    userNameDisplay: get('user-name-display'),
                    userRoleBadge: get('user-role-badge'),
                    
                    // Users management
                    inputEmailDono: get('input-email-dono'),
                    btnSetDono: get('btn-set-dono'),
                    currentDonoDisplay: get('current-dono-display'),
                    currentDonoEmail: get('current-dono-email'),
                    btnRefreshUsers: get('btn-refresh-users'),
                    usersTableBody: get('users-table-body'),
                    modalChangeRole: get('modal-change-role'),
                    selectNewRole: get('select-new-role'),
                    btnConfirmChangeRole: get('btn-confirm-change-role'),
                    btnCancelChangeRole: get('btn-cancel-change-role'),
                    
                    // Promotion elements
                    btnRequestPromo: get('btn-request-promo'),
                    promotionModal: get('modal-promotion'),
                    formPromotion: get('form-promotion'),
                    promotionPasswordInput: get('promotion-password'),
                    promotionError: get('promotion-error'),
                    btnCancelPromotion: get('btn-cancel-promotion'),
                    btnConfirmPromotion: get('btn-confirm-promotion')
                };
            },
            
            bindEvents() {
                this.dom.tabButtons.forEach(b => b.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab)));
                
                this.dom.programacaoDataInput?.addEventListener('change', (e) => this.handleProgramacaoDateChange(e.target.value));
                this.dom.btnProgramacaoAdd?.addEventListener('click', () => this.openProgramacaoModal());
                this.dom.btnCancelProgramacao?.addEventListener('click', () => this.closeProgramacaoModal());
                this.dom.btnCloseProgramacao?.addEventListener('click', () => this.closeProgramacaoModal());
                this.dom.formProgramacao?.addEventListener('submit', (e) => this.handleProgramacaoSubmit(e));
                this.dom.modalProgramacao?.addEventListener('click', (e) => {
                    if (e.target === this.dom.modalProgramacao) {
                        this.closeProgramacaoModal();
                    }
                });
                this.dom.programacaoLista?.addEventListener('click', (e) => this.handleProgramacaoListaClick(e));

                // Eventos do sistema antigo de login (se existirem)
                this.dom.btnAdminLogin?.addEventListener('click', () => this.dom.modalAdminLogin?.classList.add('active'));
                this.dom.btnAdminLogout?.addEventListener('click', () => this.handleAdminLogout());
                this.dom.formAdminLogin?.addEventListener('submit', (e) => this.handleAdminLoginAttempt(e));
                this.dom.btnCancelLogin?.addEventListener('click', () => this.dom.modalAdminLogin?.classList.remove('active'));

                this.dom.btnToggleConfig?.addEventListener('click', () => this.dom.modalConfig?.classList.add('active'));
                this.dom.btnFecharConfig?.addEventListener('click', () => this.handleFecharConfig());
                this.dom.configLogoUpload?.addEventListener('change', (e) => this.handleLogoUpload(e));
                this.dom.btnRemoveLogo?.addEventListener('click', () => this.handleLogoRemove());
                this.dom.btnExportarBackup?.addEventListener('click', () => this.handleExportarBackup());
                this.dom.btnImportarBackup?.addEventListener('click', () => this.dom.backupFileInput?.click());
                this.dom.backupFileInput?.addEventListener('change', (e) => this.handleBackupFileSelected(e));

                this.dom.btnCancelRestore?.addEventListener('click', () => this.dom.modalConfirmRestore?.classList.remove('active'));
                
                // Modal de informações do desenvolvedor
                this.dom.btnInfoDev?.addEventListener('click', () => this.dom.modalInfoDev?.classList.add('active'));
                this.dom.btnCloseInfoDev?.addEventListener('click', () => this.dom.modalInfoDev?.classList.remove('active'));
                this.dom.modalInfoDev?.addEventListener('click', (e) => {
                    if (e.target === this.dom.modalInfoDev) {
                        this.dom.modalInfoDev.classList.remove('active');
                    }
                });
                this.dom.btnConfirmRestore?.addEventListener('click', () => this.handleConfirmRestore());
                this.dom.restoreConfirmInput?.addEventListener('input', (e) => {
                    if (this.dom.btnConfirmRestore) {
                        this.dom.btnConfirmRestore.disabled = e.target.value !== 'SOBRESCREVER';
                    }
                });
                
                if (this.dom.formFornecedor) this.dom.formFornecedor.addEventListener('submit', (e) => this.handleGenericAdd(e, 'fornecedores', 'nome-fornecedor'));
                if (this.dom.tabelaFornecedores) this.dom.tabelaFornecedores.addEventListener('click', (e) => this.handleGenericDelete(e, 'fornecedores'));
                if (this.dom.formTransportadora) this.dom.formTransportadora.addEventListener('submit', (e) => this.handleGenericAdd(e, 'transportadoras', 'nome-transportadora'));
                if (this.dom.tabelaTransportadoras) this.dom.tabelaTransportadoras.addEventListener('click', (e) => this.handleGenericDelete(e, 'transportadoras'));
                if (this.dom.formRazaoSocial) this.dom.formRazaoSocial.addEventListener('submit', (e) => this.handleGenericAdd(e, 'razoesSociais', 'nome-razao-social'));
                if (this.dom.tabelaRazoesSociais) this.dom.tabelaRazoesSociais.addEventListener('click', (e) => this.handleGenericDelete(e, 'razoesSociais'));
                if (this.dom.formObra) this.dom.formObra.addEventListener('submit', (e) => this.handleGenericAdd(e, 'obras', 'nome-obra'));
                if (this.dom.tabelaObras) this.dom.tabelaObras.addEventListener('click', (e) => this.handleGenericDelete(e, 'obras'));
                this.dom.formProduto?.addEventListener('submit', (e) => this.handleProdutoAdd(e));
                this.dom.tabelaProdutos?.addEventListener('click', (e) => this.handleProdutoDelete(e));

                this.dom.formEntrada?.addEventListener('submit', (e) => this.handleEntradaSubmit(e));
                this.dom.btnProgramacaoSugestoesRefresh?.addEventListener('click', () => this.handleProgramacaoSugestoesRefresh());
                this.dom.programacaoSugestoesLista?.addEventListener('click', (e) => this.handleProgramacaoSugestaoClick(e));
                this.dom.entrada?.placa?.addEventListener('input', (e) => this.formatarPlaca(e.target));
                this.dom.entrada?.placa?.addEventListener('blur', (e) => this.handlePlacaBlur(e));
                this.dom.checkPesagemDupla?.addEventListener('change', (e) => {
                    this.dom.containerPeso1Eixo2?.classList.toggle('hidden', !e.target.checked);
                    if (this.dom.entrada?.peso1eixo2) {
                        this.dom.entrada.peso1eixo2.required = e.target.checked;
                    }
                    const labelEixo1 = this.dom.entrada?.peso1eixo1?.previousElementSibling;
                    if (labelEixo1) {
                        labelEixo1.textContent = e.target.checked ? '1ª Pesagem - Eixo 1 (kg)' : '1ª Pesagem (kg)';
                    }
                });
                this.dom.entrada?.hasNf2?.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    this.dom.entradaNf2Container?.classList.toggle('hidden', !isChecked);
                    if (this.dom.entrada?.nf2) {
                        this.dom.entrada.nf2.required = isChecked;
                        if (!isChecked) { this.dom.entrada.nf2.value = ''; }
                    }
                });
                [this.dom.saidaPesquisaPlaca, this.dom.saidaFiltroData, this.dom.saidaFiltroFornecedor, this.dom.saidaFiltroProduto].forEach(el => {
                    el?.addEventListener('input', () => this.renderPendentes());
                });
                this.dom.btnLimparFiltrosSaida?.addEventListener('click', () => this.limparFiltrosSaida());
                
                this.dom.visualizadorPesquisaPlaca?.addEventListener('input', () => this.renderPendentes());
                this.dom.visualizadorOrdenacao?.addEventListener('change', () => this.renderPendentes());
                this.dom.listaPendentes?.addEventListener('click', (e) => this.handlePendenteSelect(e));
                
                this.dom.btnFecharTicket?.addEventListener('click', () => this.dom.modalTicket?.classList.remove('active'));
                
                // Evento para mudar tamanho do ticket
                this.dom.selectTicketSize?.addEventListener('change', (e) => {
                    // Remove classes anteriores
                    document.body.classList.remove('ticket-size-a4', 'ticket-size-a5', 'ticket-size-termica');
                    // Adiciona nova classe
                    document.body.classList.add(`ticket-size-${e.target.value}`);
                    // Salvar preferência no localStorage
                    localStorage.setItem('ticketSize', e.target.value);
                });
                
                // Restaurar tamanho preferido do ticket
                const savedTicketSize = localStorage.getItem('ticketSize') || 'a5';
                if (this.dom.selectTicketSize) {
                    this.dom.selectTicketSize.value = savedTicketSize;
                    document.body.classList.add(`ticket-size-${savedTicketSize}`);
                }
                
                this.dom.btnImprimir?.addEventListener('click', () => window.print());
                this.dom.btnBaixarTicketPdf?.addEventListener('click', () => {
                    if (this.state.currentTicket) {
                        if (this.state.currentTicket.pesoLiquido !== undefined) {
                            this.exportarTicketPDF();
                        } else {
                            this.exportarTicketEntradaPDF();
                        }
                    }
                });
                // Eventos dos filtros de Relatórios
                [this.dom.filtroPesquisaInput, this.dom.filtroProduto, this.dom.filtroFornecedor, this.dom.filtroTransportadora, this.dom.filtroCertificado, this.dom.filtroObra, this.dom.filtroDataInicio, this.dom.filtroDataFim, this.dom.filtroMotorista].forEach(el => {
                    if (el) {
                        el.addEventListener('input', () => {
                            this.state.reportsCurrentPage = 1;
                            this.renderRelatorios();
                        });
                    }
                });
                // Manter botão antigo de PDF por compatibilidade
                if (this.dom.btnExportPdf) this.dom.btnExportPdf.addEventListener('click', () => this.exportarRelatorioPDF());
                if (this.dom.btnExportExcel) this.dom.btnExportExcel.addEventListener('click', () => this.exportarRelatorioExcel());
                this.dom.btnExportAgregado?.addEventListener('click', () => this.exportarControleAgregado());
                this.dom.btnImportExcel?.addEventListener('click', () => this.dom.importExcelInput?.click());
                this.dom.importExcelInput?.addEventListener('change', (e) => this.handleImportarRelatorio(e));
                
                // Novos botões com dropdowns
                document.querySelectorAll('.filtro-rapido-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.aplicarFiltroRapido(e.currentTarget.dataset.periodo, e.currentTarget));
                });
                
                this.dom.btnExportPdfToggle?.addEventListener('click', () => this.toggleDropdown('pdf'));
                this.dom.btnExportExcelToggle?.addEventListener('click', () => this.toggleDropdown('excel'));
                
                // Fechar dropdowns ao clicar fora
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.export-dropdown')) {
                        document.querySelectorAll('.export-dropdown-content').forEach(d => d.classList.remove('active'));
                    }
                });
                
                // Novos botões de exportação com opções
                document.getElementById('btn-export-pdf-simples')?.addEventListener('click', () => this.exportarRelatorioPDF());
                document.getElementById('btn-export-pdf-completo')?.addEventListener('click', () => this.exportarRelatorioPDFCompleto());
                document.getElementById('btn-export-pdf-resumo')?.addEventListener('click', () => this.exportarRelatorioPDFResumo());
                
                document.getElementById('btn-export-excel-simples')?.addEventListener('click', () => this.exportarRelatorioExcel());
                document.getElementById('btn-export-excel-multiabas')?.addEventListener('click', () => this.exportarRelatorioExcelMultiAbas());
                
                // Filtros Avançados - Toggle Expandir/Colapsar
                this.dom.btnToggleFiltrosAvancados?.addEventListener('click', () => {
                    const isHidden = this.dom.filtrosAvancadosContent.classList.contains('hidden');
                    this.dom.filtrosAvancadosContent.classList.toggle('hidden');
                    this.dom.btnToggleFiltrosAvancados.textContent = isHidden ? '▲ Recolher' : '▼ Expandir';
                });

                // Filtros de Faixa de Peso Rápida
                document.querySelectorAll('.filtro-peso-rapido').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const min = e.currentTarget.dataset.min;
                        const max = e.currentTarget.dataset.max;
                        this.dom.filtroPesoMin.value = min;
                        this.dom.filtroPesoMax.value = max;
                        this.state.reportsCurrentPage = 1;
                        this.renderRelatorios();
                        this.atualizarBadgeFiltrosAtivos();
                    });
                });

                // Filtros de Horário
                document.querySelectorAll('.filtro-horario-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const inicio = e.currentTarget.dataset.inicio;
                        const fim = e.currentTarget.dataset.fim;
                        document.querySelectorAll('.filtro-horario-btn').forEach(b => b.classList.remove('active', 'bg-purple-600', 'text-white'));
                        
                        this.dom.filtroHoraInicio.value = inicio;
                        this.dom.filtroHoraFim.value = fim;
                        e.currentTarget.classList.add('active', 'bg-purple-600', 'text-white');
                        
                        this.state.reportsCurrentPage = 1;
                        this.renderRelatorios();
                        this.atualizarBadgeFiltrosAtivos();
                    });
                });

                // Filtros de Horário Manual (inputs)
                [this.dom.filtroHoraInicio, this.dom.filtroHoraFim].forEach(el => {
                    if (el) {
                        el.addEventListener('input', () => {
                            document.querySelectorAll('.filtro-horario-btn').forEach(b => b.classList.remove('active', 'bg-purple-600', 'text-white'));
                            this.state.reportsCurrentPage = 1;
                            this.renderRelatorios();
                            this.atualizarBadgeFiltrosAtivos();
                        });
                    }
                });

                // Filtros de Status
                document.querySelectorAll('.filtro-status-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const status = e.currentTarget.dataset.status;
                        document.querySelectorAll('.filtro-status-btn').forEach(b => b.classList.remove('active', 'bg-purple-600', 'text-white'));
                        
                        if (this.state.filtrosAvancados.statusAtivo === status) {
                            this.state.filtrosAvancados.statusAtivo = null;
                        } else {
                            this.state.filtrosAvancados.statusAtivo = status;
                            e.currentTarget.classList.add('active', 'bg-purple-600', 'text-white');
                        }
                        
                        this.state.reportsCurrentPage = 1;
                        this.renderRelatorios();
                        this.atualizarBadgeFiltrosAtivos();
                    });
                });

                // Filtros de Peso Min/Max
                [this.dom.filtroPesoMin, this.dom.filtroPesoMax].forEach(el => {
                    if (el) {
                        el.addEventListener('input', () => {
                            this.state.reportsCurrentPage = 1;
                            this.renderRelatorios();
                            this.atualizarBadgeFiltrosAtivos();
                        });
                    }
                });

                // Busca Avançada
                [this.dom.filtroCampo1, this.dom.filtroOperador1, this.dom.filtroValor1, 
                 this.dom.filtroLogico, this.dom.filtroCampo2, this.dom.filtroOperador2, this.dom.filtroValor2].forEach(el => {
                    if (el) {
                        el.addEventListener('input', () => {
                            this.state.reportsCurrentPage = 1;
                            this.renderRelatorios();
                            this.atualizarBadgeFiltrosAtivos();
                        });
                    }
                });

                // Limpar Filtros Avançados
                this.dom.btnLimparFiltrosAvancados?.addEventListener('click', () => this.limparFiltrosAvancados());
                document.getElementById('btn-export-excel-agregado')?.addEventListener('click', () => this.exportarControleAgregado());
                document.getElementById('btn-export-csv')?.addEventListener('click', () => this.exportarCSV());
                
                // NOVO: Exportação Personalizada
                document.getElementById('btn-export-custom')?.addEventListener('click', () => this.abrirModalExportacao());
                document.getElementById('btn-close-export-custom')?.addEventListener('click', () => {
                    document.getElementById('modal-export-custom').classList.remove('active');
                });
                document.getElementById('btn-cancel-export-custom')?.addEventListener('click', () => {
                    document.getElementById('modal-export-custom').classList.remove('active');
                });
                document.getElementById('form-export-custom')?.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleExportacaoPersonalizada();
                });
                
                // NOVO: Envio por Email
                document.getElementById('btn-enviar-email')?.addEventListener('click', () => this.abrirModalEnviarEmail());
                document.getElementById('btn-close-enviar-email')?.addEventListener('click', () => {
                    document.getElementById('modal-enviar-email').classList.remove('active');
                });
                document.getElementById('btn-cancel-enviar-email')?.addEventListener('click', () => {
                    document.getElementById('modal-enviar-email').classList.remove('active');
                });
                document.getElementById('form-enviar-email')?.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.prepararEnvioEmail();
                });
                
                // Event listeners para os botões do modal de email
                document.querySelectorAll('.email-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        const aba = tab.getAttribute('data-tab');
                        this.trocarAbaEmail(aba);
                    });
                });
                
                document.getElementById('btn-adicionar-destinatario')?.addEventListener('click', () => this.adicionarDestinatario());
                document.getElementById('btn-carregar-favoritos')?.addEventListener('click', () => this.carregarFavoritos());
                document.getElementById('btn-inserir-resumo')?.addEventListener('click', () => this.inserirVariavel('{RESUMO}'));
                document.getElementById('btn-inserir-periodo')?.addEventListener('click', () => this.inserirVariavel('{PERIODO}'));
                document.getElementById('btn-inserir-fornecedores')?.addEventListener('click', () => this.inserirVariavel('{DETALHES_FORNECEDORES}'));
                document.getElementById('btn-inserir-materiais')?.addEventListener('click', () => this.inserirVariavel('{DETALHES_MATERIAIS}'));
                document.getElementById('btn-copiar-dados')?.addEventListener('click', () => this.copiarDadosFormatados());
                document.getElementById('btn-visualizar-anexo')?.addEventListener('click', () => this.visualizarAnexo());
                document.getElementById('btn-preparar-email')?.addEventListener('click', () => this.prepararEnvioEmail());
                document.getElementById('btn-limpar-historico')?.addEventListener('click', () => this.limparHistoricoEmails());
                document.getElementById('btn-adicionar-favorito')?.addEventListener('click', () => this.adicionarEmailFavorito());
                
                // Listener para o select de modelos
                document.getElementById('email-modelo-select')?.addEventListener('change', () => this.aplicarModelo());
                
                // Listener para os cards de modelos
                document.querySelectorAll('.modelo-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const modelo = card.getAttribute('data-modelo');
                        this.aplicarModeloPersonalizado(modelo);
                    });
                });
                
                // Controles do modal de exportação
                document.getElementById('btn-select-all-cols')?.addEventListener('click', () => {
                    document.querySelectorAll('.export-col-checkbox').forEach(cb => cb.checked = true);
                });
                document.getElementById('btn-deselect-all-cols')?.addEventListener('click', () => {
                    document.querySelectorAll('.export-col-checkbox').forEach(cb => cb.checked = false);
                });
                
                // Mostrar/ocultar opções baseado no formato
                document.querySelectorAll('input[name="export-format"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        const format = e.target.value;
                        document.getElementById('pdf-options').classList.toggle('hidden', format !== 'pdf');
                        document.getElementById('excel-options').classList.toggle('hidden', format !== 'excel');
                    });
                });
                
                // Mostrar campo de marca d'água
                document.getElementById('pdf-watermark')?.addEventListener('change', (e) => {
                    document.getElementById('watermark-text-container').classList.toggle('hidden', !e.target.checked);
                });
                
                // Divergências
                this.dom.btnExportDivergencias?.addEventListener('click', () => this.exportarDivergencias());
                
                // Filtros favoritos
                this.dom.btnSalvarFiltroFavorito?.addEventListener('click', () => this.salvarFiltroFavorito());
                this.dom.btnCarregarFiltroFavorito?.addEventListener('click', () => this.carregarFiltroFavorito());
                
                this.dom.tabelaTickets?.addEventListener('click', (e) => this.handleAcoesTicket(e));
                this.dom.formEditTicket?.addEventListener('submit', (e) => this.handleUpdateTicketSubmit(e));

                // Eventos dos filtros de Tickets
                [this.dom.filtroTicketDataInicio, this.dom.filtroTicketDataFim, this.dom.filtroTicketProduto, this.dom.filtroTicketPesquisa, this.dom.filtroTicketObra, this.dom.filtroTicketCliente, this.dom.filtroTicketTransportadora].forEach(el => {
                    if (el) {
                        el.addEventListener('input', () => {
                            this.state.ticketsCurrentPage = 1;
                            this.renderTickets();
                        });
                    }
                });
                this.dom.btnLimparFiltrosTicket?.addEventListener('click', () => {
                    if (this.dom.filtroTicketDataInicio) this.dom.filtroTicketDataInicio.value = '';
                    if (this.dom.filtroTicketDataFim) this.dom.filtroTicketDataFim.value = '';
                    if (this.dom.filtroTicketProduto) this.dom.filtroTicketProduto.value = '';
                    if (this.dom.filtroTicketPesquisa) this.dom.filtroTicketPesquisa.value = '';
                    if (this.dom.filtroTicketObra) this.dom.filtroTicketObra.value = '';
                    if (this.dom.filtroTicketCliente) this.dom.filtroTicketCliente.value = '';
                    if (this.dom.filtroTicketTransportadora) this.dom.filtroTicketTransportadora.value = '';
                    this.state.ticketsCurrentPage = 1;
                    this.renderTickets();
                });

                this.dom.dbFiltroFornecedor?.addEventListener('change', () => this.renderDashboard());
                this.dom.dbFiltroProduto?.addEventListener('change', () => this.renderDashboard());
                this.dom.dbFiltroTransportadora?.addEventListener('change', () => this.renderDashboard());
                this.dom.btnDbLimparFiltros?.addEventListener('click', () => {
                    if (this.dom.dbFiltroFornecedor) this.dom.dbFiltroFornecedor.value = '';
                    if (this.dom.dbFiltroProduto) this.dom.dbFiltroProduto.value = '';
                    if (this.dom.dbFiltroTransportadora) this.dom.dbFiltroTransportadora.value = '';
                    this.renderDashboard();
                });

                this.dom.btnCancelDelete?.addEventListener('click', () => { 
                    this.state.ticketToDeleteId = null; 
                    this.dom.modalConfirmDelete?.classList.remove('active'); 
                });
                this.dom.btnConfirmDelete?.addEventListener('click', () => this.handleConfirmDelete());
                if (this.dom.dashboardUltimasPesagens) {
                    this.dom.dashboardUltimasPesagens.addEventListener('click', (e) => this.handleAcoesTicket(e));
                }
                
                // Eventos de promoção
                this.dom.btnRequestPromo?.addEventListener('click', () => this.dom.promotionModal?.classList.add('active'));
                this.dom.btnCancelPromotion?.addEventListener('click', () => {
                    this.dom.promotionModal?.classList.remove('active');
                    if (this.dom.promotionPasswordInput) this.dom.promotionPasswordInput.value = '';
                    if (this.dom.promotionError) this.dom.promotionError.textContent = '';
                });
                this.dom.formPromotion?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.requestPromotion();
                });
                
                // Eventos de validação de peso da nota (entrada)
                this.dom.entrada.pesoNota?.addEventListener('input', (e) => this.validarPesoNota(e.target));
                this.dom.entrada.peso1eixo1?.addEventListener('input', () => this.atualizarValidacaoPesoNota());
                this.dom.entrada.peso1eixo2?.addEventListener('input', () => this.atualizarValidacaoPesoNota());
                
                // NOVO: Eventos da aba de Atividades
                document.getElementById('filtro-log-usuario')?.addEventListener('change', () => this.carregarLogs());
                document.getElementById('filtro-log-acao')?.addEventListener('change', () => this.carregarLogs());
                document.getElementById('filtro-log-periodo')?.addEventListener('change', () => this.carregarLogs());
                document.getElementById('btn-limpar-filtros-logs')?.addEventListener('click', () => {
                    document.getElementById('filtro-log-usuario').value = '';
                    document.getElementById('filtro-log-acao').value = '';
                    document.getElementById('filtro-log-periodo').value = '7d';
                    this.carregarLogs();
                });
                document.getElementById('btn-exportar-logs')?.addEventListener('click', () => this.exportarLogsExcel());
                
                // Event listeners para timeline paginado
                document.getElementById('timeline-limit')?.addEventListener('change', () => {
                    this.state.timelinePage = 1;
                    this.carregarLogs();
                });
                
                document.getElementById('timeline-prev')?.addEventListener('click', () => {
                    if (this.state.timelinePage > 1) {
                        this.state.timelinePage--;
                        this.carregarLogs();
                    }
                });
                
                document.getElementById('timeline-next')?.addEventListener('click', () => {
                    this.state.timelinePage = (this.state.timelinePage || 1) + 1;
                    this.carregarLogs();
                });
            },

            // ===== FORMATAÇÃO E VALIDAÇÃO DE PLACA (MELHORADA) =====
            formatarPlaca(input) {
                // Remove caracteres especiais e converte para maiúsculas
                let valor = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                
                // Limita a 7 caracteres
                if (valor.length > 7) {
                    valor = valor.substring(0, 7);
                }
                
                input.value = valor;
                
                // Validação de padrão brasileiro (Mercosul ou antigo)
                if (valor.length === 7) {
                    const padraoAntigo = /^[A-Z]{3}[0-9]{4}$/; // ABC1234
                    const padraoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/; // ABC1D23
                    
                    if (padraoAntigo.test(valor) || padraoMercosul.test(valor)) {
                        // Placa válida
                        input.classList.remove('input-error');
                        input.classList.add('input-success');
                        input.setCustomValidity(''); // Remove erro customizado
                        
                        // Remove classe de sucesso após 2 segundos
                        setTimeout(() => input.classList.remove('input-success'), 2000);
                    } else {
                        // Placa inválida
                        input.classList.remove('input-success');
                        input.classList.add('input-error');
                        input.setCustomValidity('Formato de placa inválido. Use ABC1234 ou ABC1D23');
                        
                        // Remove classe de erro após 3 segundos
                        setTimeout(() => input.classList.remove('input-error'), 3000);
                    }
                } else if (valor.length > 0) {
                    // Ainda digitando, remove classes
                    input.classList.remove('input-error', 'input-success');
                    input.setCustomValidity('');
                }
            },

            // Validação adicional de CNPJ (opcional, para uso futuro)
            validarCNPJ(cnpj) {
                cnpj = cnpj.replace(/[^\d]/g, '');
                
                if (cnpj.length !== 14) return false;
                
                // Elimina CNPJs inválidos conhecidos
                if (/^(\d)\1+$/.test(cnpj)) return false;
                
                // Validação dos dígitos verificadores
                let tamanho = cnpj.length - 2;
                let numeros = cnpj.substring(0, tamanho);
                let digitos = cnpj.substring(tamanho);
                let soma = 0;
                let pos = tamanho - 7;
                
                for (let i = tamanho; i >= 1; i--) {
                    soma += numeros.charAt(tamanho - i) * pos--;
                    if (pos < 2) pos = 9;
                }
                
                let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
                if (resultado != digitos.charAt(0)) return false;
                
                tamanho = tamanho + 1;
                numeros = cnpj.substring(0, tamanho);
                soma = 0;
                pos = tamanho - 7;
                
                for (let i = tamanho; i >= 1; i--) {
                    soma += numeros.charAt(tamanho - i) * pos--;
                    if (pos < 2) pos = 9;
                }
                
                resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
                if (resultado != digitos.charAt(1)) return false;
                
                return true;
            },

            updateConnectionStatus(status) {
                if (!this.dom.statusDot || !this.dom.statusText) return;
                this.dom.statusDot.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-gray-400', 'animate-pulse');
                this.dom.statusText.classList.remove('text-gray-800', 'text-green-700', 'text-red-700', 'text-yellow-700', 'dark:text-gray-100', 'dark:text-green-400', 'dark:text-red-400', 'dark:text-yellow-400');
                
                switch (status) {
                    case 'online':
                        this.dom.statusDot.classList.add('bg-green-500');
                        this.dom.statusText.classList.add('text-green-700', 'dark:text-green-400');
                        this.dom.statusText.textContent = '🟢 Online';
                        break;
                    case 'offline':
                        this.dom.statusDot.classList.add('bg-red-500');
                        this.dom.statusText.classList.add('text-red-700', 'dark:text-red-400');
                        this.dom.statusText.textContent = '🔴 Offline';
                        break;
                    default:
                        this.dom.statusDot.classList.add('bg-yellow-500', 'animate-pulse');
                        this.dom.statusText.classList.add('text-yellow-700', 'dark:text-yellow-400');
                        this.dom.statusText.textContent = '🟡 Conectando...';
                }
            },

            updateUIAccess() {
                const isAdmin = this.state.isAdmin;
                this.dom.body.classList.toggle('admin', isAdmin);
                const currentActive = document.querySelector('.tab-button.active');
                const currentTab = currentActive?.dataset?.tab;

                if (isAdmin) {
                    if (!currentTab || currentTab === 'visualizador') {
                        this.switchTab('entrada');
                    }
                    return;
                }

                if (this.state.userRole === 'visualizador') {
                    const restrictedTabs = new Set(['entrada', 'saida', 'cadastros', 'usuarios', 'atividades']);
                    if (!currentTab || restrictedTabs.has(currentTab)) {
                        this.switchTab('visualizador');
                    }
                } else {
                    if (!currentTab || currentTab === 'visualizador') {
                        this.switchTab('tickets');
                    }
                }
            },

            handleAdminLoginAttempt(e) {
                e.preventDefault();
                const password = this.dom.adminPasswordInput.value;
                const correctPassword = this.state.config.password || '';

                if (password === correctPassword) {
                    this.state.isAdmin = true;
                    this.updateUIAccess();
                    this.dom.modalAdminLogin.classList.remove('active');
                    this.dom.adminPasswordInput.value = '';
                    this.dom.loginErrorMsg.textContent = '';
                } else {
                    this.dom.loginErrorMsg.textContent = 'Senha incorreta.';
                }
            },

            // ===== FUNÇÕES DE AUTENTICAÇÃO =====
            
            bindAuthEvents() {
                // Login
                this.dom.formLogin?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('login-email').value;
                    const password = document.getElementById('login-password').value;
                    await this.handleLogin(email, password);
                });

                // Register
                this.dom.formRegister?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const nome = document.getElementById('register-nome').value;
                    const email = document.getElementById('register-email').value;
                    const password = document.getElementById('register-password').value;
                    const confirmPassword = document.getElementById('register-password-confirm').value;
                    
                    if (password !== confirmPassword) {
                        alert("❌ As senhas não coincidem!");
                        return;
                    }
                    
                    await this.handleRegister(nome, email, password);
                });

                // Toggle between login and register
                this.dom.btnShowRegister?.addEventListener('click', () => {
                    this.dom.formLogin.classList.add('hidden');
                    this.dom.formRegister.classList.remove('hidden');
                });

                this.dom.btnBackToLogin?.addEventListener('click', () => {
                    this.dom.formRegister.classList.add('hidden');
                    this.dom.formLogin.classList.remove('hidden');
                });

                // Logout
                this.dom.btnLogout?.addEventListener('click', () => this.handleLogout());
                
                // Set Dono
                this.dom.btnSetDono?.addEventListener('click', () => this.handleSetDono());
                
                // Refresh users
                this.dom.btnRefreshUsers?.addEventListener('click', () => this.loadUsers());
                
                // Modal de mudança de role
                this.dom.btnConfirmChangeRole?.addEventListener('click', () => this.handleConfirmChangeRole());
                this.dom.btnCancelChangeRole?.addEventListener('click', () => this.dom.modalChangeRole?.classList.remove('active'));
                
                // Close modal
                this.dom.modalChangeRole?.querySelector('.modal-close')?.addEventListener('click', () => {
                    this.dom.modalChangeRole?.classList.remove('active');
                });
            },

            // ==================== FUNÇÕES DE SEGURANÇA ====================
            
            // Verificar se está bloqueado por tentativas
            checkLoginLockout() {
                const now = Date.now();
                if (this.state.security.lockedUntil > now) {
                    const remainingTime = Math.ceil((this.state.security.lockedUntil - now) / 60000);
                    return {
                        locked: true,
                        message: `🔒 Conta temporariamente bloqueada por segurança.\n\nAguarde ${remainingTime} minuto(s) para tentar novamente.`
                    };
                }
                return { locked: false };
            },
            
            // Registrar tentativa de login
            recordLoginAttempt(success) {
                if (success) {
                    // Resetar tentativas após login bem-sucedido
                    this.state.security.loginAttempts = 0;
                    this.state.security.lockedUntil = 0;
                    localStorage.setItem('loginAttempts', '0');
                    localStorage.setItem('lockedUntil', '0');
                } else {
                    // Incrementar tentativas falhadas
                    this.state.security.loginAttempts++;
                    this.state.security.lastAttemptTime = Date.now();
                    localStorage.setItem('loginAttempts', this.state.security.loginAttempts.toString());
                    localStorage.setItem('lastAttemptTime', this.state.security.lastAttemptTime.toString());
                    
                    // Bloquear se excedeu tentativas
                    if (this.state.security.loginAttempts >= this.state.security.maxLoginAttempts) {
                        this.state.security.lockedUntil = Date.now() + this.state.security.lockoutDuration;
                        localStorage.setItem('lockedUntil', this.state.security.lockedUntil.toString());
                    }
                }
            },
            
            // Sanitizar input para prevenir XSS
            sanitizeInput(value) {
                if (typeof value !== 'string') return value;
                return value
                    .replace(/[<>]/g, '') // Remove tags HTML
                    .replace(/javascript:/gi, '') // Remove javascript:
                    .replace(/on\w+=/gi, '') // Remove event handlers
                    .trim();
            },
            
            // Validar senha forte
            validatePasswordStrength(password) {
                const requirements = {
                    length: password.length >= 8,
                    uppercase: /[A-Z]/.test(password),
                    lowercase: /[a-z]/.test(password),
                    number: /[0-9]/.test(password),
                    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
                };
                
                const strength = Object.values(requirements).filter(Boolean).length;
                
                return {
                    isValid: requirements.length && requirements.uppercase && requirements.number,
                    strength: strength,
                    requirements: requirements,
                    message: this.getPasswordStrengthMessage(requirements)
                };
            },
            
            getPasswordStrengthMessage(req) {
                const missing = [];
                if (!req.length) missing.push('mínimo 8 caracteres');
                if (!req.uppercase) missing.push('1 letra maiúscula');
                if (!req.number) missing.push('1 número');
                
                if (missing.length === 0) return '✅ Senha forte!';
                return `⚠️ Falta: ${missing.join(', ')}`;
            },
            
            // Monitorar inatividade da sessão
            startSessionMonitor() {
                // Resetar timer a cada atividade
                const resetActivity = () => {
                    this.state.security.lastActivity = Date.now();
                };
                
                // Eventos de atividade
                ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
                    document.addEventListener(event, resetActivity);
                });
                
                // Verificar timeout a cada minuto
                setInterval(() => {
                    const inactive = Date.now() - this.state.security.lastActivity;
                    if (inactive > this.state.security.sessionTimeout) {
                        if (this.state.currentUser) {
                            alert('⏰ Sessão expirada por inatividade.\n\nPor segurança, você será desconectado.');
                            this.handleLogout();
                        }
                    }
                }, 60000); // Verificar a cada 1 minuto
            },
            
            // Validar e sanitizar todos os inputs de formulário
            sanitizeFormData(formData) {
                const sanitized = {};
                for (const [key, value] of Object.entries(formData)) {
                    if (typeof value === 'string') {
                        sanitized[key] = this.sanitizeInput(value);
                    } else {
                        sanitized[key] = value;
                    }
                }
                return sanitized;
            },

            async handleLogin(email, password) {
                // Verificar bloqueio por tentativas
                const lockCheck = this.checkLoginLockout();
                if (lockCheck.locked) {
                    alert(lockCheck.message);
                    return;
                }
                
                // Sanitizar inputs
                email = this.sanitizeInput(email);
                
                const btnLogin = document.getElementById('btn-login');
                btnLogin.disabled = true;
                btnLogin.textContent = '⏳ Entrando...';
                
                try {
                    await signInWithEmailAndPassword(this.state.auth, email, password);
                    console.log("✅ Login bem-sucedido");
                    
                    // Registrar sucesso
                    this.recordLoginAttempt(true);
                    
                    // Iniciar monitoramento de sessão
                    this.startSessionMonitor();
                    
                } catch (error) {
                    console.error("❌ Erro no login:", error);
                    
                    // Registrar falha
                    this.recordLoginAttempt(false);
                    
                    // Mostrar mensagem com contador de tentativas
                    const remainingAttempts = this.state.security.maxLoginAttempts - this.state.security.loginAttempts;
                    let message = `❌ Erro: ${this.getAuthErrorMessage(error.code)}`;
                    
                    if (remainingAttempts > 0 && remainingAttempts <= 3) {
                        message += `\n\n⚠️ Tentativas restantes: ${remainingAttempts}`;
                    }
                    
                    alert(message);
                } finally {
                    btnLogin.disabled = false;
                    btnLogin.textContent = '🚀 Entrar';
                }
            },

            async handleRegister(nome, email, password) {
                // Sanitizar inputs
                nome = this.sanitizeInput(nome);
                email = this.sanitizeInput(email);
                
                // Validar senha forte
                const passwordCheck = this.validatePasswordStrength(password);
                if (!passwordCheck.isValid) {
                    alert(`🔒 Senha fraca!\n\n${passwordCheck.message}\n\nPor segurança, use uma senha mais forte.`);
                    return;
                }
                
                const btnRegister = document.getElementById('btn-register');
                btnRegister.disabled = true;
                btnRegister.textContent = '⏳ Criando conta...';
                
                try {
                    console.log("🔍 Iniciando registro de conta...");
                    console.log("📧 Email:", email);
                    console.log("👤 Nome:", nome);
                    
                    // PRIMEIRO: Criar usuário no Firebase Auth
                    console.log("🔐 Criando usuário no Firebase Auth...");
                    const userCredential = await createUserWithEmailAndPassword(this.state.auth, email, password);
                    const user = userCredential.user;
                    console.log("✅ Usuário criado no Auth:", user.uid);
                    
                    // DEPOIS: Verificar se é o primeiro usuário (agora temos permissão pois estamos autenticados)
                    console.log("🔍 Verificando se é o primeiro usuário...");
                    let isFirstUser = false;
                    try {
                        const usersSnapshot = await getDocs(collection(this.state.db, 'users'));
                        isFirstUser = usersSnapshot.empty;
                        console.log(`📊 Primeiro usuário: ${isFirstUser ? 'SIM' : 'NÃO'}`);
                    } catch (checkError) {
                        console.warn("⚠️ Não foi possível verificar usuários existentes, assumindo que não é o primeiro");
                        isFirstUser = false;
                    }
                    
                    // Determinar role: primeiro usuário = dono, demais = visualizador
                    const role = isFirstUser ? 'dono' : 'visualizador';
                    console.log(`👑 Role definida: ${role}`);
                    
                    // Criar documento do usuário no Firestore
                    console.log("💾 Salvando dados do usuário no Firestore...");
                    await setDoc(doc(this.state.db, 'users', user.uid), {
                        uid: user.uid,
                        email: email,
                        nome: nome,
                        role: role,
                        criadoEm: Timestamp.now(),
                        ativo: true,
                        canEditProgramacao: false
                    });
                    console.log("✅ Dados salvos no Firestore");
                    
                    // Se for o primeiro usuário, configurar como dono no sistema
                    if (isFirstUser) {
                        console.log("⚙️ Configurando email do dono no sistema...");
                        await setDoc(doc(this.state.db, 'config', 'system'), {
                            emailDono: email
                        }, { merge: true });
                        console.log("✅ Email do dono configurado");
                    }
                    
                    console.log(`✅ Conta criada com sucesso como ${role}`);
                    
                    // Aguardar um pouco para garantir que o documento foi salvo
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    alert(`✅ Conta criada e login realizado com sucesso!\n\nVocê foi registrado como: ${role === 'dono' ? '👑 Proprietário' : '👁️ Visualizador'}\n\nAguarde enquanto carregamos o sistema...`);
                    
                    // NÃO fazer logout - deixar o sistema carregar automaticamente via onAuthStateChanged
                    console.log("✅ Login automático após registro");
                    
                    // Limpar campos do formulário
                    document.getElementById('register-nome').value = '';
                    document.getElementById('register-email').value = '';
                    document.getElementById('register-password').value = '';
                    document.getElementById('register-password-confirm').value = '';
                    
                } catch (error) {
                    console.error("❌ Erro ao criar conta:", error);
                    
                    // Tratamento de erros específicos
                    let mensagemErro = this.getAuthErrorMessage(error.code);
                    
                    // Se o erro for de permissão do Firestore, dar uma mensagem mais clara
                    if (error.code === 'permission-denied') {
                        mensagemErro = 'Erro de permissão. Verifique as regras do Firestore no console do Firebase.';
                    }
                    
                    alert(`❌ Erro ao criar conta:\n${mensagemErro}`);
                } finally {
                    btnRegister.disabled = false;
                    btnRegister.textContent = '✅ Criar Conta';
                }
            },

            async handleUserAuthenticated(user) {
                try {
                    console.log("🔍 Buscando dados do usuário:", user.email);
                    
                    // Aguardar um pouco para garantir que o documento foi salvo
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Buscar dados do usuário no Firestore
                    const userDocRef = doc(this.state.db, 'users', user.uid);
                    let userDocSnap = await getDoc(userDocRef);
                    
                    // Se não encontrar, tentar mais 2 vezes com delay
                    let attempts = 0;
                    while (!userDocSnap.exists() && attempts < 2) {
                        console.log(`⏳ Tentativa ${attempts + 1} de 3...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        userDocSnap = await getDoc(userDocRef);
                        attempts++;
                    }
                    
                    if (!userDocSnap.exists()) {
                        console.error("❌ Documento do usuário não encontrado após 3 tentativas");
                        alert("❌ Erro: Dados do usuário não encontrados.\n\nPor favor, tente fazer login novamente.\n\nSe o problema persistir, entre em contato com o administrador.");
                        await signOut(this.state.auth);
                        return;
                    }
                    
                    const userData = userDocSnap.data();
                    
                    // Verificar se usuário está ativo
                    if (!userData.ativo) {
                        alert("❌ Sua conta foi desativada. Entre em contato com o administrador.");
                        await signOut(this.state.auth);
                        return;
                    }
                    
                    this.state.currentUser = user;
                    this.state.userDoc = userData;
                    this.state.userRole = userData.role;
                    this.state.userId = user.uid;
                    
                    // Definir isAdmin baseado no role
                    this.state.isAdmin = (this.state.userRole === 'dono' || this.state.userRole === 'operador');
                    
                    // Carregar email do dono
                    await this.loadDonoEmail();
                    
                    // Registrar login
                    await this.registerLogin(user.uid);
                    
                    // Anexar listeners do Firestore (agora que está autenticado)
                    this.attachFirestoreListeners();
                    
                    // Mostrar interface principal
                    this.showMainApp();
                    
                    if (this.state.unsubscribeUserDoc) {
                        this.state.unsubscribeUserDoc();
                    }
                    this.state.unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
                        if (!snapshot.exists()) {
                            return;
                        }

                        const dadosAtualizados = snapshot.data();
                        const roleAnterior = this.state.userRole;

                        this.state.userDoc = dadosAtualizados;
                        this.state.userRole = dadosAtualizados.role;
                        this.state.isAdmin = (this.state.userRole === 'dono' || this.state.userRole === 'operador');

                        if (roleAnterior !== this.state.userRole) {
                            this.applyRolePermissions();
                        } else {
                            this.updateProgramacaoControls();
                            this.renderProgramacaoDia();
                        }
                    });

                    console.log("✅ Usuário carregado:", this.state.userDoc);
                } catch (error) {
                    console.error("❌ Erro ao carregar usuário:", error);
                    
                    if (error.code === 'permission-denied') {
                        alert("❌ Erro de permissão ao carregar dados.\n\nVerifique as regras do Firestore no Firebase Console.");
                    } else {
                        alert("❌ Erro ao carregar dados.\n\nTente novamente ou entre em contato com o suporte.");
                    }
                    
                    await signOut(this.state.auth);
                }
            },

            async registerLogin(uid) {
                try {
                    await addDoc(collection(this.state.db, 'login_history'), {
                        uid: uid,
                        email: this.state.currentUser.email,
                        timestamp: Timestamp.now(),
                        role: this.state.userRole
                    });
                    
                    // Registrar no log de atividades
                    await this.registrarLog('login', 'Usuário fez login no sistema');
                } catch (error) {
                    console.error("⚠️ Erro ao registrar login:", error);
                }
            },

            // ===== SISTEMA DE LOGS E AUDITORIA =====
            async registrarLog(acao, descricao, detalhes = {}) {
                if (!this.state.currentUser || !this.state.db) return;
                
                try {
                    await addDoc(collection(this.state.db, 'logs'), {
                        usuarioId: this.state.currentUser.uid,
                        usuarioNome: this.state.userDoc?.nome || 'Desconhecido',
                        usuarioEmail: this.state.currentUser.email,
                        role: this.state.userRole,
                        acao: acao,
                        descricao: descricao,
                        detalhes: detalhes,
                        timestamp: Timestamp.now()
                    });
                    console.log(`📝 Log registrado: ${acao} - ${descricao}`);
                } catch (error) {
                    console.error("⚠️ Erro ao registrar log:", error);
                }
            },

            // ===== FUNÇÕES DE SKELETON LOADER E ANIMAÇÕES =====
            showStatsSkeleton(show) {
                const stats = [
                    this.dom.dbStatPesagensHoje,
                    this.dom.dbStatPesoHoje,
                    this.dom.dbStatVeiculosPatio,
                    this.dom.dbStatTicketMedio
                ];
                
                stats.forEach(stat => {
                    if (stat) {
                        if (show) {
                            stat.classList.add('skeleton');
                            stat.textContent = '...';
                        } else {
                            stat.classList.remove('skeleton');
                        }
                    }
                });
            },

            animateCounter(element, target, duration = 1000) {
                if (!element) return;
                
                const start = 0;
                const startTime = performance.now();
                
                const animate = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    
                    // Easing function (easeOutCubic)
                    const easeProgress = 1 - Math.pow(1 - progress, 3);
                    
                    const current = Math.floor(start + (target - start) * easeProgress);
                    element.textContent = current;
                    
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        element.textContent = target;
                        element.classList.remove('skeleton');
                    }
                };
                
                requestAnimationFrame(animate);
            },

            showTableSkeleton(tableBody, rows = 5) {
                if (!tableBody) return;
                
                const skeletonHTML = Array(rows).fill(0).map(() => `
                    <tr class="skeleton-table-row">
                        <td colspan="100%">
                            <div class="skeleton h-12"></div>
                        </td>
                    </tr>
                `).join('');
                
                tableBody.innerHTML = skeletonHTML;
            },

            hideTableSkeleton(tableBody) {
                if (!tableBody) return;
                tableBody.querySelectorAll('.skeleton-table-row').forEach(row => row.remove());
            },

            addFadeInAnimation(element) {
                if (element) {
                    element.classList.add('animate-fade-in');
                    setTimeout(() => element.classList.remove('animate-fade-in'), 400);
                }
            },

            async carregarLogs() {
                if (this.state.userRole !== 'dono') return;
                
                try {
                    const filtroUsuario = document.getElementById('filtro-log-usuario')?.value || '';
                    const filtroAcao = document.getElementById('filtro-log-acao')?.value || '';
                    const filtroPeriodo = document.getElementById('filtro-log-periodo')?.value || '7d';
                    
                    // Calcular data de início baseado no período
                    let dataInicio = new Date();
                    switch (filtroPeriodo) {
                        case '24h':
                            dataInicio.setHours(dataInicio.getHours() - 24);
                            break;
                        case '7d':
                            dataInicio.setDate(dataInicio.getDate() - 7);
                            break;
                        case '30d':
                            dataInicio.setDate(dataInicio.getDate() - 30);
                            break;
                        case 'todos':
                            dataInicio = new Date(0); // Epoch
                            break;
                    }
                    
                    // Buscar logs
                    let q = query(
                        collection(this.state.db, 'logs'),
                        where('timestamp', '>=', Timestamp.fromDate(dataInicio))
                    );
                    
                    const querySnapshot = await getDocs(q);
                    let logs = [];
                    
                    querySnapshot.forEach((doc) => {
                        logs.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Aplicar filtros locais
                    if (filtroUsuario) {
                        logs = logs.filter(log => log.usuarioId === filtroUsuario);
                    }
                    if (filtroAcao) {
                        logs = logs.filter(log => log.acao === filtroAcao);
                    }
                    
                    // Ordenar por timestamp decrescente
                    logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
                    
                    this.renderLogs(logs);
                    this.atualizarEstatisticasLogs(logs);
                    this.atualizarRankingUsuarios(logs);
                } catch (error) {
                    console.error("❌ Erro ao carregar logs:", error);
                    this.showNotification("Erro ao carregar logs de atividades");
                }
            },

            renderLogs(logs) {
                const timeline = document.getElementById('timeline-atividades');
                if (!timeline) return;
                
                // Atualizar resumo
                this.atualizarResumoTimeline(logs);
                
                if (logs.length === 0) {
                    timeline.innerHTML = `
                        <div class="text-center text-gray-500 py-8">
                            <p class="text-lg">🔍 Nenhuma atividade encontrada</p>
                            <p class="text-sm mt-2">Tente ajustar os filtros</p>
                        </div>
                    `;
                    document.getElementById('timeline-pagination').classList.add('hidden');
                    return;
                }
                
                // Paginação
                const limitSelect = document.getElementById('timeline-limit');
                const limit = limitSelect.value === 'all' ? logs.length : parseInt(limitSelect.value);
                const currentPage = this.state.timelinePage || 1;
                const totalPages = Math.ceil(logs.length / limit);
                const startIndex = (currentPage - 1) * limit;
                const endIndex = startIndex + limit;
                const logsToShow = logs.slice(startIndex, endIndex);
                
                const icones = {
                    'login': '🔓', 'logout': '🔒', 'criou_entrada': '📥', 'criou_saida': '📤',
                    'editou_ticket': '✏️', 'deletou_ticket': '🗑️', 'mudou_permissao': '🎭',
                        'exportou_pdf': '📕', 'exportou_excel': '📗', 'exportou_csv': '📄',
                    'exportou_json': '📋', 'importou_dados': '📥', 'cadastrou_fornecedor': '🏢',
                    'cadastrou_transportadora': '🚛', 'cadastrou_produto': '📦', 'cadastrou_obra': '🏗️',
                        'deletou_cadastro': '🗑️', 'alterou_config': '⚙️',
                        'criou_programacao': '📝', 'editou_programacao': '✏️', 'removeu_programacao': '🗑️',
                        'alterou_programacao_permissao': '🛡️'
                };
                
                // Design compacto
                timeline.innerHTML = logsToShow.map(log => {
                    const icone = icones[log.acao] || '📝';
                    const data = new Date(log.timestamp.seconds * 1000);
                    const tempoDecorrido = this.calcularTempoDecorrido(data);
                    
                    return `
                        <div class="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all">
                            <div class="text-2xl flex-shrink-0">${icone}</div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-baseline gap-2 flex-wrap">
                                    <span class="font-semibold text-sm text-gray-800">${log.usuarioNome}</span>
                                    <span class="text-xs text-gray-500">${log.acao.replace(/_/g, ' ')}</span>
                                </div>
                                <p class="text-xs text-gray-600 truncate">${log.descricao}</p>
                            </div>
                            <span class="text-xs text-gray-400 flex-shrink-0">${tempoDecorrido}</span>
                        </div>
                    `;
                }).join('');
                
                // Controles de paginação
                if (totalPages > 1) {
                    document.getElementById('timeline-pagination').classList.remove('hidden');
                    document.getElementById('timeline-page-info').textContent = `Página ${currentPage} de ${totalPages}`;
                    document.getElementById('timeline-prev').disabled = currentPage === 1;
                    document.getElementById('timeline-next').disabled = currentPage === totalPages;
                } else {
                    document.getElementById('timeline-pagination').classList.add('hidden');
                }
            },
            
            atualizarResumoTimeline(logs) {
                const total = logs.length;
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                
                const hojeLogs = logs.filter(log => {
                    const logDate = new Date(log.timestamp.seconds * 1000);
                    logDate.setHours(0, 0, 0, 0);
                    return logDate.getTime() === hoje.getTime();
                }).length;
                
                const semana = new Date();
                semana.setDate(semana.getDate() - 7);
                semana.setHours(0, 0, 0, 0);
                
                const semanaLogs = logs.filter(log => {
                    const logDate = new Date(log.timestamp.seconds * 1000);
                    return logDate >= semana;
                }).length;
                
                document.getElementById('timeline-total').textContent = total;
                document.getElementById('timeline-hoje').textContent = hojeLogs;
                document.getElementById('timeline-semana').textContent = semanaLogs;
            },

            atualizarEstatisticasLogs(logs) {
                const totalAcoes = logs.length;
                const ticketsCriados = logs.filter(l => l.acao === 'criou_entrada' || l.acao === 'criou_saida').length;
                const edicoes = logs.filter(l => l.acao === 'editou_ticket').length;
                const exclusoes = logs.filter(l => l.acao === 'deletou_ticket').length;
                
                document.getElementById('stat-total-acoes').textContent = totalAcoes;
                document.getElementById('stat-tickets-criados').textContent = ticketsCriados;
                document.getElementById('stat-edicoes').textContent = edicoes;
                document.getElementById('stat-exclusoes').textContent = exclusoes;
            },

            atualizarRankingUsuarios(logs) {
                const rankingBody = document.getElementById('ranking-usuarios-body');
                if (!rankingBody) return;
                
                // Agregar dados por usuário
                const usuarios = {};
                
                logs.forEach(log => {
                    if (!usuarios[log.usuarioId]) {
                        usuarios[log.usuarioId] = {
                            nome: log.usuarioNome,
                            email: log.usuarioEmail,
                            entradas: 0,
                            saidas: 0,
                            edicoes: 0,
                            exclusoes: 0,
                            logins: 0,
                            ultimoAcesso: log.timestamp
                        };
                    }
                    
                    const user = usuarios[log.usuarioId];
                    
                    switch (log.acao) {
                        case 'criou_entrada':
                            user.entradas++;
                            break;
                        case 'criou_saida':
                            user.saidas++;
                            break;
                        case 'editou_ticket':
                            user.edicoes++;
                            break;
                        case 'deletou_ticket':
                            user.exclusoes++;
                            break;
                        case 'login':
                            user.logins++;
                            break;
                    }
                    
                    // Atualizar último acesso
                    if (log.timestamp.seconds > user.ultimoAcesso.seconds) {
                        user.ultimoAcesso = log.timestamp;
                    }
                });
                
                // Ordenar por total de ações
                const ranking = Object.entries(usuarios).map(([id, data]) => ({
                    id,
                    ...data,
                    total: data.entradas + data.saidas + data.edicoes + data.exclusoes
                })).sort((a, b) => b.total - a.total);
                
                if (ranking.length === 0) {
                    rankingBody.innerHTML = `
                        <tr>
                            <td colspan="8" class="p-4 text-center text-gray-500">
                                Nenhum dado disponível
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                const medalhas = ['🥇', '🥈', '🥉'];
                
                rankingBody.innerHTML = ranking.map((user, index) => {
                    const ultimoAcesso = new Date(user.ultimoAcesso.seconds * 1000);
                    const medalha = index < 3 ? medalhas[index] : (index + 1);
                    
                    return `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="p-3 text-center text-lg">${medalha}</td>
                            <td class="p-3">
                                <div class="font-semibold">${user.nome}</div>
                                <div class="text-xs text-gray-500">${user.email}</div>
                            </td>
                            <td class="p-3 text-center">${user.entradas}</td>
                            <td class="p-3 text-center">${user.saidas}</td>
                            <td class="p-3 text-center">${user.edicoes}</td>
                            <td class="p-3 text-center">${user.exclusoes}</td>
                            <td class="p-3 text-center">${user.logins}</td>
                            <td class="p-3 text-sm text-gray-600">
                                ${ultimoAcesso.toLocaleDateString('pt-BR')}<br>
                                ${ultimoAcesso.toLocaleTimeString('pt-BR')}
                            </td>
                        </tr>
                    `;
                }).join('');
            },

            async carregarUsuariosParaFiltro() {
                if (this.state.userRole !== 'dono') return;
                
                try {
                    const usersSnapshot = await getDocs(collection(this.state.db, 'users'));
                    const select = document.getElementById('filtro-log-usuario');
                    if (!select) return;
                    
                    select.innerHTML = '<option value="">Todos os usuários</option>';
                    
                    usersSnapshot.forEach((doc) => {
                        const user = doc.data();
                        const option = document.createElement('option');
                        option.value = doc.id;
                        option.textContent = `${user.nome} (${user.email})`;
                        select.appendChild(option);
                    });
                } catch (error) {
                    console.error("❌ Erro ao carregar usuários:", error);
                }
            },

            calcularTempoDecorrido(data) {
                const agora = new Date();
                const diff = agora - data;
                
                const minutos = Math.floor(diff / 60000);
                const horas = Math.floor(diff / 3600000);
                const dias = Math.floor(diff / 86400000);
                
                if (minutos < 1) return 'agora mesmo';
                if (minutos < 60) return `há ${minutos} min`;
                if (horas < 24) return `há ${horas}h`;
                return `há ${dias} dia${dias > 1 ? 's' : ''}`;
            },

            async exportarLogsExcel() {
                if (this.state.userRole !== 'dono') return;
                
                try {
                    const logsSnapshot = await getDocs(collection(this.state.db, 'logs'));
                    const logs = [];
                    
                    logsSnapshot.forEach((doc) => {
                        const log = doc.data();
                        logs.push({
                            'Data/Hora': new Date(log.timestamp.seconds * 1000).toLocaleString('pt-BR'),
                            'Usuário': log.usuarioNome,
                            'Email': log.usuarioEmail,
                            'Nível': log.role,
                            'Ação': log.acao,
                            'Descrição': log.descricao
                        });
                    });
                    
                    const ws = XLSX.utils.json_to_sheet(logs);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Logs de Atividades");
                    XLSX.writeFile(wb, `logs_atividades_${new Date().toISOString().split('T')[0]}.xlsx`);
                    
                    this.showNotification("✅ Logs exportados com sucesso!");
                } catch (error) {
                    console.error("❌ Erro ao exportar logs:", error);
                    this.showNotification("❌ Erro ao exportar logs");
                }
            },

            // ==================== SISTEMA DE ENVIO DE EMAIL PROFISSIONAL ====================
            
            // Estado do email
            emailDestinatarios: [],
            emailModelos: {
                formal: `Prezados,\n\nSegue em anexo o relatório de pesagens solicitado, referente ao período de {PERIODO}.\n\n{RESUMO}\n\n{DETALHES_FORNECEDORES}\n\n{DETALHES_MATERIAIS}\n\nO arquivo está disponível no formato selecionado para análise e conferência.\n\nQualquer dúvida, estou à disposição.\n\nAtenciosamente,\n{NOME}`,
                simples: `Olá!\n\nSegue o relatório de pesagens em anexo.\n\n{RESUMO}\n\n{DETALHES_FORNECEDORES}\n\n{DETALHES_MATERIAIS}\n\nAtenciosamente,\n{NOME}`,
                detalhado: `Prezados,\n\nEncaminho o relatório completo de pesagens para o período de {PERIODO}.\n\n📊 RESUMO ESTATÍSTICO:\n{RESUMO}\n\n{DETALHES_FORNECEDORES}\n\n{DETALHES_MATERIAIS}\n\nO arquivo em anexo contém todos os detalhes das pesagens realizadas, incluindo:\n• Datas e horários de cada pesagem\n• Pesos bruto, tara e líquido\n• Informações dos veículos\n• Dados dos produtos/materiais\n• Informações de fornecedores\n• Observações registradas\n\nPara qualquer esclarecimento adicional ou análise complementar, estou à disposição.\n\nAtenciosamente,\n{NOME}`,
                urgente: `⚡ URGENTE - RELATÓRIO DE PESAGENS\n\nPrezados,\n\nConforme solicitado com urgência, segue em anexo o relatório de pesagens do período {PERIODO}.\n\n{RESUMO}\n\n{DETALHES_FORNECEDORES}\n\n{DETALHES_MATERIAIS}\n\nPor favor, confirmem o recebimento.\n\nAtenciosamente,\n{NOME}`
            },
            
            // Trocar aba do modal
            trocarAbaEmail(aba) {
                document.querySelectorAll('.email-tab').forEach(tab => {
                    tab.classList.remove('active');
                    tab.style.borderBottom = 'none';
                    tab.style.color = '#666';
                });
                
                document.querySelectorAll('.email-tab-content').forEach(content => {
                    content.style.display = 'none';
                });
                
                const tabButton = document.querySelector(`[data-tab="${aba}"]`);
                const tabContent = document.getElementById(`email-tab-${aba}`);
                
                if (tabButton) {
                    tabButton.classList.add('active');
                    tabButton.style.borderBottom = '3px solid #667eea';
                    tabButton.style.color = '#667eea';
                }
                
                if (tabContent) tabContent.style.display = 'block';
                
                if (aba === 'historico') this.carregarHistoricoEmails();
                else if (aba === 'favoritos') this.carregarListaFavoritos();
            },
            
            // Adicionar destinatário
            adicionarDestinatario() {
                const input = document.getElementById('email-destinatario-input');
                const email = input.value.trim();
                
                if (!email) return;
                
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    this.showNotification('⚠️ Email inválido!');
                    return;
                }
                
                if (this.emailDestinatarios.includes(email)) {
                    this.showNotification('⚠️ Email já adicionado!');
                    return;
                }
                
                this.emailDestinatarios.push(email);
                this.renderizarChips();
                input.value = '';
                input.focus();
            },
            
            // Remover destinatário
            removerDestinatario(email) {
                this.emailDestinatarios = this.emailDestinatarios.filter(e => e !== email);
                this.renderizarChips();
            },
            
            // Renderizar chips
            renderizarChips() {
                const container = document.getElementById('email-chips-container');
                if (!container) return;
                
                if (this.emailDestinatarios.length === 0) {
                    container.innerHTML = '<div style="color: #999; font-size: 14px;">Nenhum destinatário adicionado</div>';
                    return;
                }
                
                container.innerHTML = this.emailDestinatarios.map(email => `
                    <div class="email-chip">
                        <span>${email}</span>
                        <span class="email-chip-remove" data-email="${email}">×</span>
                    </div>
                `).join('');
                
                // Adicionar event listeners aos botões de remover
                container.querySelectorAll('.email-chip-remove').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const email = btn.getAttribute('data-email');
                        this.removerDestinatario(email);
                    });
                });
            },
            
            // Aplicar modelo
            aplicarModelo() {
                const select = document.getElementById('email-modelo-select');
                const textarea = document.getElementById('email-mensagem');
                const modelo = select.value;
                
                if (!modelo || modelo === 'custom') {
                    textarea.value = '';
                    return;
                }
                
                let mensagem = this.emailModelos[modelo];
                mensagem = this.processarVariaveisEmail(mensagem);
                textarea.value = mensagem;
            },
            
            // Aplicar modelo personalizado
            aplicarModeloPersonalizado(tipo) {
                document.getElementById('email-modelo-select').value = tipo;
                this.aplicarModelo();
                this.trocarAbaEmail('enviar');
                this.showNotification('✅ Modelo aplicado!');
            },
            
            // Processar variáveis
            processarVariaveisEmail(texto) {
                const pesagens = this.getFilteredPesagens();
                const pesoTotal = pesagens.reduce((sum, p) => sum + (p.pesoLiquido || 0), 0);
                const dataInicio = this.dom.filtroDataInicio?.value;
                const dataFim = this.dom.filtroDataFim?.value;
                const periodo = dataInicio && dataFim 
                    ? `${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`
                    : 'Todas as datas';
                
                // Resumo básico
                const resumo = `• Total de pesagens: ${pesagens.length}\n• Peso total: ${this.formatarPeso(pesoTotal)} kg\n• Período: ${periodo}`;
                
                // Detalhes por fornecedor
                const fornecedoresMap = new Map();
                pesagens.forEach(p => {
                    const forn = p.fornecedor || 'Não informado';
                    if (!fornecedoresMap.has(forn)) {
                        fornecedoresMap.set(forn, { peso: 0, quantidade: 0 });
                    }
                    const dados = fornecedoresMap.get(forn);
                    dados.peso += p.pesoLiquido || 0;
                    dados.quantidade += 1;
                });
                
                let detalhesFornecedores = '📦 DETALHAMENTO POR FORNECEDOR:\n';
                const fornecedoresArray = Array.from(fornecedoresMap.entries()).sort((a, b) => b[1].peso - a[1].peso);
                if (fornecedoresArray.length > 0) {
                    fornecedoresArray.forEach(([forn, dados]) => {
                        detalhesFornecedores += `\n• ${forn}:\n`;
                        detalhesFornecedores += `  - Quantidade: ${dados.quantidade} pesagens\n`;
                        detalhesFornecedores += `  - Peso total: ${this.formatarPeso(dados.peso)} kg`;
                    });
                } else {
                    detalhesFornecedores += '\nNenhum fornecedor registrado.';
                }
                
                // Detalhes por material/produto
                const materiaisMap = new Map();
                pesagens.forEach(p => {
                    const mat = p.produto || 'Não informado';
                    if (!materiaisMap.has(mat)) {
                        materiaisMap.set(mat, { peso: 0, quantidade: 0 });
                    }
                    const dados = materiaisMap.get(mat);
                    dados.peso += p.pesoLiquido || 0;
                    dados.quantidade += 1;
                });
                
                let detalhesMateriais = '🏗️ DETALHAMENTO POR MATERIAL/PRODUTO:\n';
                const materiaisArray = Array.from(materiaisMap.entries()).sort((a, b) => b[1].peso - a[1].peso);
                if (materiaisArray.length > 0) {
                    materiaisArray.forEach(([mat, dados]) => {
                        detalhesMateriais += `\n• ${mat}:\n`;
                        detalhesMateriais += `  - Quantidade: ${dados.quantidade} pesagens\n`;
                        detalhesMateriais += `  - Peso total: ${this.formatarPeso(dados.peso)} kg`;
                    });
                } else {
                    detalhesMateriais += '\nNenhum material/produto registrado.';
                }
                
                return texto
                    .replace('{RESUMO}', resumo)
                    .replace('{PERIODO}', periodo)
                    .replace('{NOME}', this.state.config.nome || 'Sistema de Pesagens')
                    .replace('{DETALHES_FORNECEDORES}', detalhesFornecedores)
                    .replace('{DETALHES_MATERIAIS}', detalhesMateriais);
            },
            
            // Inserir variável
            inserirVariavel(variavel) {
                const textarea = document.getElementById('email-mensagem');
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                
                textarea.value = text.substring(0, start) + variavel + text.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + variavel.length;
                textarea.focus();
            },
            
            // Copiar dados formatados
            async copiarDadosFormatados() {
                const pesagens = this.getFilteredPesagens();
                const pesoTotal = pesagens.reduce((sum, p) => sum + (p.pesoLiquido || 0), 0);
                const dataInicio = this.dom.filtroDataInicio?.value;
                const dataFim = this.dom.filtroDataFim?.value;
                const periodo = dataInicio && dataFim 
                    ? `${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`
                    : 'Todas as datas';
                
                const dados = `📊 RELATÓRIO DE PESAGENS\n\n📅 Período: ${periodo}\n🔢 Total de Pesagens: ${pesagens.length}\n⚖️ Peso Total: ${this.formatarPeso(pesoTotal)} kg\n\n${pesagens.slice(0, 10).map((p, i) => `\n${i + 1}. ${new Date((p.dataSaida || p.dataEntrada).seconds * 1000).toLocaleString('pt-BR')}\n   Placa: ${p.placa || 'N/A'}\n   Produto: ${p.produto || 'N/A'}\n   Peso Líquido: ${this.formatarPeso(p.pesoLiquido || 0)} kg\n`).join('\n')}\n\n${pesagens.length > 10 ? `... e mais ${pesagens.length - 10} pesagens` : ''}\n\n---\nGerado por ${this.state.config.nome}`;
                
                try {
                    await navigator.clipboard.writeText(dados);
                    this.showNotification('✅ Dados copiados!');
                } catch (error) {
                    this.showNotification('❌ Erro ao copiar');
                }
            },
            
            // Visualizar anexo
            async visualizarAnexo() {
                const formato = document.querySelector('input[name="email-formato"]:checked')?.value;
                this.showNotification('📄 Gerando preview...');
                
                try {
                    if (formato === 'pdf') {
                        await this.exportarRelatorioPDF();
                        this.showNotification('✅ PDF gerado! Verifique os downloads.');
                    } else {
                        await this.exportarRelatorioExcelMultiAbas();
                        this.showNotification('✅ Excel gerado! Verifique os downloads.');
                    }
                } catch (error) {
                    this.showNotification('❌ Erro ao gerar preview');
                }
            },
            
            // Carregar favoritos
            carregarFavoritos() {
                const favoritos = JSON.parse(localStorage.getItem('emailFavoritos') || '[]');
                
                if (favoritos.length === 0) {
                    this.showNotification('⚠️ Nenhum favorito salvo!');
                    return;
                }
                
                favoritos.forEach(email => {
                    if (!this.emailDestinatarios.includes(email)) {
                        this.emailDestinatarios.push(email);
                    }
                });
                
                this.renderizarChips();
                this.showNotification('✅ Favoritos carregados!');
            },
            
            // Salvar histórico
            salvarHistoricoEmail(destinatarios, assunto, formato) {
                const historico = JSON.parse(localStorage.getItem('emailHistorico') || '[]');
                
                historico.unshift({
                    data: new Date().toISOString(),
                    destinatarios: destinatarios,
                    assunto: assunto,
                    formato: formato
                });
                
                if (historico.length > 50) historico.pop();
                localStorage.setItem('emailHistorico', JSON.stringify(historico));
            },
            
            // Carregar histórico
            carregarHistoricoEmails() {
                const historico = JSON.parse(localStorage.getItem('emailHistorico') || '[]');
                const container = document.getElementById('email-historico-lista');
                
                if (!container) return;
                
                if (historico.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">📭 Nenhum email enviado ainda</div>';
                    return;
                }
                
                container.innerHTML = historico.map((item, index) => `
                    <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; background: white;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #333; margin-bottom: 5px;">${item.assunto}</div>
                                <div style="font-size: 13px; color: #666;">Para: ${item.destinatarios.join(', ')}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 12px; color: #999;">${new Date(item.data).toLocaleString('pt-BR')}</div>
                                <span style="display: inline-block; margin-top: 5px; padding: 4px 8px; background: #667eea; color: white; border-radius: 4px; font-size: 11px;">
                                    ${item.formato.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <button class="btn-reutilizar-email" data-index="${index}"
                            style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                            🔄 Reutilizar
                        </button>
                    </div>
                `).join('');
                
                // Adicionar event listeners aos botões de reutilizar
                container.querySelectorAll('.btn-reutilizar-email').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const index = parseInt(btn.getAttribute('data-index'));
                        const item = historico[index];
                        this.reutilizarEmail(item.destinatarios.join(';'), item.assunto);
                    });
                });
            },
            
            // Reutilizar email
            reutilizarEmail(destinatarios, assunto) {
                const emails = destinatarios.split(';');
                this.emailDestinatarios = emails;
                document.getElementById('email-assunto').value = assunto;
                this.renderizarChips();
                this.trocarAbaEmail('enviar');
                this.showNotification('✅ Dados carregados!');
            },
            
            // Limpar histórico
            limparHistoricoEmails() {
                if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
                    localStorage.removeItem('emailHistorico');
                    this.carregarHistoricoEmails();
                    this.showNotification('✅ Histórico limpo!');
                }
            },
            
            // Carregar lista de favoritos
            carregarListaFavoritos() {
                const favoritos = JSON.parse(localStorage.getItem('emailFavoritos') || '[]');
                const container = document.getElementById('email-favoritos-lista');
                
                if (!container) return;
                
                if (favoritos.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">⭐ Nenhum email favoritado</div>';
                    return;
                }
                
                container.innerHTML = favoritos.map((email, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; background: white;">
                        <div style="font-weight: 600; color: #333;">${email}</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-adicionar-favorito" data-email="${email}"
                                style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                                ➕ Adicionar
                            </button>
                            <button class="btn-remover-favorito" data-email="${email}"
                                style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('');
                
                // Adicionar event listeners
                container.querySelectorAll('.btn-adicionar-favorito').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const email = btn.getAttribute('data-email');
                        this.adicionarDestinatarioDireto(email);
                    });
                });
                
                container.querySelectorAll('.btn-remover-favorito').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const email = btn.getAttribute('data-email');
                        this.removerFavorito(email);
                    });
                });
            },
            
            // Adicionar email favorito
            adicionarEmailFavorito() {
                const email = prompt('Digite o email para adicionar aos favoritos:');
                if (!email) return;
                
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    this.showNotification('⚠️ Email inválido!');
                    return;
                }
                
                const favoritos = JSON.parse(localStorage.getItem('emailFavoritos') || '[]');
                
                if (favoritos.includes(email)) {
                    this.showNotification('⚠️ Email já está nos favoritos!');
                    return;
                }
                
                favoritos.push(email);
                localStorage.setItem('emailFavoritos', JSON.stringify(favoritos));
                this.carregarListaFavoritos();
                this.showNotification('✅ Email adicionado aos favoritos!');
            },
            
            // Adicionar destinatário direto
            adicionarDestinatarioDireto(email) {
                if (!this.emailDestinatarios.includes(email)) {
                    this.emailDestinatarios.push(email);
                    this.renderizarChips();
                    this.trocarAbaEmail('enviar');
                    this.showNotification('✅ Destinatário adicionado!');
                } else {
                    this.showNotification('⚠️ Destinatário já adicionado!');
                }
            },
            
            // Remover favorito
            removerFavorito(email) {
                if (confirm(`Remover ${email} dos favoritos?`)) {
                    let favoritos = JSON.parse(localStorage.getItem('emailFavoritos') || '[]');
                    favoritos = favoritos.filter(e => e !== email);
                    localStorage.setItem('emailFavoritos', JSON.stringify(favoritos));
                    this.carregarListaFavoritos();
                    this.showNotification('✅ Email removido dos favoritos!');
                }
            },
            
            // Abrir modal (atualizado)
            abrirModalEnviarEmail() {
                const modal = document.getElementById('modal-enviar-email');
                if (!modal) return;
                
                this.emailDestinatarios = [];
                this.renderizarChips();
                
                const pesagens = this.getFilteredPesagens();
                const pesoTotal = pesagens.reduce((sum, p) => sum + (p.pesoLiquido || 0), 0);
                
                document.getElementById('preview-total-pesagens').textContent = pesagens.length;
                document.getElementById('preview-peso-total').textContent = this.formatarPeso(pesoTotal) + ' kg';
                
                const dataInicio = this.dom.filtroDataInicio?.value;
                const dataFim = this.dom.filtroDataFim?.value;
                const periodo = dataInicio && dataFim 
                    ? `${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`
                    : 'Todas as datas';
                document.getElementById('preview-periodo').textContent = periodo;
                
                const assuntoInput = document.getElementById('email-assunto');
                if (assuntoInput) {
                    assuntoInput.value = `Relatório de Pesagens - ${periodo}`;
                }
                
                document.getElementById('email-mensagem').value = '';
                document.getElementById('email-modelo-select').value = '';
                
                this.trocarAbaEmail('enviar');
                
                const input = document.getElementById('email-destinatario-input');
                if (input) {
                    input.onkeypress = (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.adicionarDestinatario();
                        }
                    };
                }
                
                modal.classList.add('active');
            },
            
            // Preparar e enviar email (atualizado)
            async prepararEnvioEmail() {
                if (this.emailDestinatarios.length === 0) {
                    this.showNotification('⚠️ Adicione pelo menos um destinatário!');
                    return;
                }
                
                const assunto = document.getElementById('email-assunto')?.value;
                const mensagem = document.getElementById('email-mensagem')?.value;
                const formato = document.querySelector('input[name="email-formato"]:checked')?.value;
                const salvarFavoritos = document.getElementById('email-salvar-favoritos')?.checked;
                
                if (!assunto) {
                    this.showNotification('⚠️ Digite o assunto do email!');
                    return;
                }
                
                this.showNotification('📥 Baixando arquivo...');
                
                try {
                    if (formato === 'pdf') {
                        await this.exportarRelatorioPDF();
                    } else {
                        await this.exportarRelatorioExcelMultiAbas();
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    let mensagemFinal = mensagem || 'Segue relatório de pesagens em anexo.';
                    mensagemFinal = this.processarVariaveisEmail(mensagemFinal);
                    mensagemFinal += `\n\n---\n📎 O arquivo ${formato === 'pdf' ? 'PDF' : 'Excel'} foi baixado. Por favor, anexe-o antes de enviar.\n\nGerado por ${this.state.config.nome}`;
                    
                    const destinatarios = this.emailDestinatarios.join(';');
                    const corpo = encodeURIComponent(mensagemFinal);
                    const mailtoLink = `mailto:${destinatarios}?subject=${encodeURIComponent(assunto)}&body=${corpo}`;
                    
                    window.location.href = mailtoLink;
                    
                    this.showNotification('✅ Arquivo baixado! Cliente de email aberto.');
                    
                    this.salvarHistoricoEmail(this.emailDestinatarios, assunto, formato);
                    
                    if (salvarFavoritos) {
                        const favoritosAtuais = JSON.parse(localStorage.getItem('emailFavoritos') || '[]');
                        this.emailDestinatarios.forEach(email => {
                            if (!favoritosAtuais.includes(email)) {
                                favoritosAtuais.push(email);
                            }
                        });
                        localStorage.setItem('emailFavoritos', JSON.stringify(favoritosAtuais));
                    }
                    
                    setTimeout(() => {
                        document.getElementById('modal-enviar-email').classList.remove('active');
                    }, 2000);
                    
                } catch (error) {
                    console.error('❌ Erro:', error);
                    this.showNotification('❌ Erro ao preparar email');
                }
            },
            
            // ==================== FIM DO SISTEMA DE EMAIL ====================
            
            // Enviar relatório por email (100% gratuito com mailto)
            // ==================== FIM DO SISTEMA DE EMAIL ====================

            async loadDonoEmail() {
                try {
                    const configDoc = await getDoc(doc(this.state.db, 'config', 'system'));
                    if (configDoc.exists()) {
                        this.state.emailDono = configDoc.data().emailDono;
                        
                        if (this.dom.currentDonoEmail) {
                            this.dom.currentDonoEmail.textContent = this.state.emailDono;
                            this.dom.currentDonoDisplay?.classList.remove('hidden');
                        }
                    }
                } catch (error) {
                    console.error("⚠️ Erro ao carregar email do dono:", error);
                }
            },

            showAuthScreen() {
                if (this.dom.authScreen) {
                    this.dom.authScreen.classList.remove('hidden');
                }
                const appContainer = document.getElementById('app-container');
                if (appContainer) {
                    appContainer.style.opacity = '0';
                    appContainer.style.display = 'none';
                }
                
                // Ocultar loading overlay
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                    }, 300);
                }
            },

            showMainApp() {
                if (this.dom.authScreen) {
                    this.dom.authScreen.classList.add('hidden');
                }
                
                const appContainer = document.getElementById('app-container');
                if (appContainer) {
                    appContainer.style.display = 'block';
                    setTimeout(() => {
                        appContainer.style.opacity = '1';
                    }, 50);
                }
                
                // Atualizar header com info do usuário
                if (this.dom.userNameDisplay) {
                    this.dom.userNameDisplay.textContent = this.state.userDoc.nome;
                }
                if (this.dom.userRoleBadge) {
                    this.dom.userRoleBadge.innerHTML = this.getRoleBadgeHTML(this.state.userRole);
                }
                
                // Aplicar permissões de visualização
                this.applyRolePermissions();
                
                // Se for dono, carregar lista de usuários
                if (this.state.userRole === 'dono') {
                    this.loadUsers();
                }
                
                // Mostrar a primeira aba permitida caso nenhuma esteja ativa
                if (!document.querySelector('.tab-button.active')) {
                    if (this.state.userRole === 'visualizador') {
                        this.switchTab('visualizador');
                    } else {
                        this.switchTab('entrada');
                    }
                }

                this.setupProgramacaoDia();
            },

            // ===== PROGRAMAÇÃO DO DIA =====
            canEditProgramacao() {
                return this.state.userRole === 'dono' || this.state.userRole === 'operador' || !!this.state.userDoc?.canEditProgramacao;
            },

            updateProgramacaoControls() {
                const canEdit = this.canEditProgramacao();
                if (this.dom.btnProgramacaoAdd) {
                    this.dom.btnProgramacaoAdd.classList.toggle('hidden', !canEdit);
                }
                if (this.dom.programacaoSemPermissao) {
                    this.dom.programacaoSemPermissao.classList.toggle('hidden', canEdit);
                }
            },

            setupProgramacaoDia() {
                if (!this.dom.programacaoDataInput) return;

                if (!this.state.programacaoDataSelecionada) {
                    const hoje = new Date();
                    this.state.programacaoDataSelecionada = hoje.toISOString().split('T')[0];
                }

                if (this.dom.programacaoDataInput.value !== this.state.programacaoDataSelecionada) {
                    this.dom.programacaoDataInput.value = this.state.programacaoDataSelecionada;
                }
                if (this.dom.programacaoDataModal) {
                    this.dom.programacaoDataModal.value = this.state.programacaoDataSelecionada;
                }

                this.updateProgramacaoControls();
                this.handleProgramacaoDateChange(this.state.programacaoDataSelecionada);
            },

            updateProgramacaoDataLabel() {
                if (!this.dom.programacaoDataLabel || !this.state.programacaoDataSelecionada) return;
                const data = new Date(`${this.state.programacaoDataSelecionada}T00:00:00`);
                const dataFormatada = data.toLocaleDateString('pt-BR');
                const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'long' });
                const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
                this.dom.programacaoDataLabel.textContent = `${dataFormatada} (${diaSemanaCapitalizado})`;
            },

            handleProgramacaoDateChange(dateStr) {
                if (!dateStr) return;
                this.state.programacaoDataSelecionada = dateStr;
                if (this.dom.programacaoDataInput && this.dom.programacaoDataInput.value !== dateStr) {
                    this.dom.programacaoDataInput.value = dateStr;
                }
                if (this.dom.programacaoDataModal) {
                    this.dom.programacaoDataModal.value = dateStr;
                }
                if (this.dom.programacaoLista) {
                    this.dom.programacaoLista.innerHTML = `
                        <div class="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">
                            Carregando programação...
                        </div>
                    `;
                }
                if (this.dom.programacaoMetaLabel) {
                    this.dom.programacaoMetaLabel.textContent = 'Carregando...';
                }
                this.state.programacaoResumo = [];
                this.initProgramacaoListener(dateStr);
                this.updateProgramacaoDataLabel();
                this.renderProgramacaoSugestoesEntrada();
            },

            initProgramacaoListener(dateStr) {
                if (!this.state.db) return;

                if (this.state.unsubscribeProgramacao) {
                    this.state.unsubscribeProgramacao();
                    this.state.unsubscribeProgramacao = null;
                }

                const programacaoRef = doc(this.state.db, 'programacoesDia', dateStr);
                this.state.unsubscribeProgramacao = onSnapshot(programacaoRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        this.state.programacaoDia = (data.instrucoes || []).map(instrucao => ({ ...instrucao }));
                        this.state.programacaoMeta = {
                            atualizadoPorNome: data.atualizadoPorNome || '',
                            atualizadoPorRole: data.atualizadoPorRole || '',
                            atualizadoEm: data.atualizadoEm || null
                        };
                    } else {
                        this.state.programacaoDia = [];
                        this.state.programacaoMeta = null;
                    }
                    this.renderProgramacaoDia();
                }, (error) => {
                    console.error('❌ Erro no listener de programação:', error);
                });
            },

            renderProgramacaoDia() {
                if (!this.dom.programacaoLista) return;

                this.updateProgramacaoDataLabel();
                this.updateProgramacaoControls();

                const canEdit = this.canEditProgramacao();
                const instrucoes = this.state.programacaoDia || [];
                const resumo = this.calcularResumoProgramacao();
                const resumoPorId = new Map(resumo.map(item => [item.id, item]));

                if (this.dom.programacaoMetaLabel) {
                    if (this.state.programacaoMeta?.atualizadoEm) {
                        const metaDate = this.toDate(this.state.programacaoMeta.atualizadoEm);
                        const tempo = metaDate ? this.calcularTempoDecorrido(metaDate) : '';
                        const autor = this.state.programacaoMeta.atualizadoPorNome || '—';
                        const cargo = this.formatRoleLabel(this.state.programacaoMeta.atualizadoPorRole);
                        this.dom.programacaoMetaLabel.textContent = `Atualizado por ${autor}${cargo ? ` (${cargo})` : ''}${tempo ? ` • ${tempo}` : ''}`;
                    } else {
                        this.dom.programacaoMetaLabel.textContent = 'Nenhuma atualização registrada para esta data.';
                    }
                }

                if (instrucoes.length === 0) {
                    this.dom.programacaoLista.innerHTML = `
                        <div class="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">
                            Nenhuma programação cadastrada para esta data.
                        </div>
                    `;
                    return;
                }

                const sorted = [...instrucoes].sort((a, b) => {
                    const aTime = this.toDate(a.criadoEm)?.getTime() || this.toDate(a.atualizadoEm)?.getTime() || 0;
                    const bTime = this.toDate(b.criadoEm)?.getTime() || this.toDate(b.atualizadoEm)?.getTime() || 0;
                    return aTime - bTime;
                });

                this.dom.programacaoLista.innerHTML = sorted.map(instrucao => {
                    const infoResumo = resumoPorId.get(instrucao.id);
                    const quantidadeFormatada = this.formatQuantidade(instrucao.quantidade);
                    const unidadeTexto = instrucao.unidade ? instrucao.unidade.trim() : '';
                    const quantidadeTexto = quantidadeFormatada ? `${quantidadeFormatada}${unidadeTexto ? ` ${unidadeTexto}` : ''}` : '';
                    const atualizadoEm = this.toDate(instrucao.atualizadoEm);
                    const tempoAtualizacao = atualizadoEm ? this.calcularTempoDecorrido(atualizadoEm) : '';
                    const autor = instrucao.atualizadoPorNome || instrucao.criadoPorNome || '—';
                    const cargo = this.formatRoleLabel(instrucao.atualizadoPorRole || instrucao.criadoPorRole);
                    const statusBadge = this.getProgramacaoStatusBadge(infoResumo);
                    const contagemHtml = this.getProgramacaoContagemTexto(infoResumo, instrucao);
                    const progressoHtml = this.getProgramacaoProgressBar(infoResumo);

                    const linhas = [
                        instrucao.produto ? `<p class="text-sm font-semibold text-gray-800">📦 ${instrucao.produto}${quantidadeTexto ? ` • ${quantidadeTexto}` : ''}</p>` : '',
                        instrucao.destino ? `<p class="text-sm text-gray-600">🏗️ Destino: ${instrucao.destino}</p>` : '',
                        instrucao.observacao ? `<p class="text-sm text-gray-600">📝 ${instrucao.observacao}</p>` : ''
                    ].filter(Boolean).join('');

                    const botoes = canEdit ? `
                        <div class="flex gap-2">
                            <button type="button" data-action="edit" data-id="${instrucao.id}" class="text-xs font-semibold text-blue-600 hover:text-blue-800">✏️ Editar</button>
                            <button type="button" data-action="delete" data-id="${instrucao.id}" class="text-xs font-semibold text-red-600 hover:text-red-800">🗑️ Remover</button>
                        </div>
                    ` : '';

                    return `
                        <div class="rounded-lg bg-white border border-gray-200 p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div class="flex-1 space-y-2">
                                <div class="flex items-start justify-between gap-3">
                                    <div class="space-y-1">
                                        ${linhas || '<p class="text-sm text-gray-600">📝 Instrução sem detalhes.</p>'}
                                    </div>
                                    ${statusBadge || ''}
                                </div>
                                ${contagemHtml || ''}
                                ${progressoHtml || ''}
                                <p class="text-xs text-gray-500">${autor}${cargo ? ` • ${cargo}` : ''}${tempoAtualizacao ? ` • ${tempoAtualizacao}` : ''}</p>
                            </div>
                            ${botoes}
                        </div>
                    `;
                }).join('');

                this.renderProgramacaoSugestoesEntrada();
            },

            normalizarTexto(valor) {
                if (valor === null || valor === undefined) return '';
                return String(valor)
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim()
                    .toLowerCase();
            },

            extrairDataKey(valor) {
                if (!valor) return null;
                let data;
                if (valor instanceof Date) {
                    data = valor;
                } else if (typeof valor === 'object' && typeof valor.seconds === 'number') {
                    data = new Date(valor.seconds * 1000);
                } else if (typeof valor === 'string') {
                    const parsed = new Date(valor);
                    if (!Number.isNaN(parsed.valueOf())) {
                        data = parsed;
                    }
                }
                if (!data || Number.isNaN(data.valueOf())) return null;
                return data.toISOString().split('T')[0];
            },

            pesagemCombinaComInstrucao(pesagem, instrucao) {
                if (!pesagem || !instrucao) return false;
                if (this.normalizarTexto(pesagem.produto) !== this.normalizarTexto(instrucao.produto)) {
                    return false;
                }

                const destinoInstrucao = this.normalizarTexto(instrucao.destino);
                if (!destinoInstrucao) {
                    return true;
                }

                const candidatos = [
                    this.normalizarTexto(pesagem.obra),
                    this.normalizarTexto(pesagem.cliente),
                    this.normalizarTexto(pesagem.transportadora),
                    this.normalizarTexto(pesagem.destino)
                ].filter(Boolean);

                if (candidatos.length === 0) {
                    return false;
                }

                return candidatos.some(valor => valor === destinoInstrucao || valor.includes(destinoInstrucao));
            },

            calcularResumoProgramacao() {
                const instrucoes = this.state.programacaoDia || [];
                const dataSelecionada = this.state.programacaoDataSelecionada;
                if (!dataSelecionada || instrucoes.length === 0) {
                    this.state.programacaoResumo = [];
                    return [];
                }

                const pendentesDia = (this.state.pesagensPendentes || []).filter(p => this.extrairDataKey(p.dataEntrada) === dataSelecionada);
                const completasDia = (this.state.pesagensCompletas || []).filter(p => this.extrairDataKey(p.dataEntrada) === dataSelecionada);

                const registros = [
                    ...pendentesDia.map(p => ({ ...p, __status: 'pendente' })),
                    ...completasDia.map(p => ({ ...p, __status: 'completa' }))
                ];

                const resumo = instrucoes.map(instrucao => {
                    const matches = registros.filter(reg => this.pesagemCombinaComInstrucao(reg, instrucao));
                    const iniciados = matches.length;
                    let quantidade = null;
                    if (instrucao.quantidade !== null && instrucao.quantidade !== undefined && instrucao.quantidade !== '') {
                        const parsed = Number(instrucao.quantidade);
                        quantidade = Number.isNaN(parsed) ? null : parsed;
                    }
                    const pendentes = matches.filter(item => item.__status === 'pendente').length;
                    const completas = matches.filter(item => item.__status === 'completa').length;
                    let status = 'pendente';
                    if (quantidade !== null && quantidade > 0) {
                        if (completas >= quantidade && pendentes === 0) {
                            status = 'concluido';
                        } else if (iniciados > 0) {
                            status = 'em_andamento';
                        }
                    } else {
                        if (iniciados === 0) {
                            status = 'pendente';
                        } else if (pendentes === 0) {
                            status = 'concluido';
                        } else {
                            status = 'em_andamento';
                        }
                    }

                    const progresso = quantidade && quantidade > 0 ? Math.min(completas / quantidade, 1) : null;

                    return {
                        id: instrucao.id,
                        executado: iniciados,
                        quantidade,
                        pendentes,
                        completas,
                        status,
                        progresso
                    };
                });

                this.state.programacaoResumo = resumo;
                return resumo;
            },

            getProgramacaoStatusBadge(infoResumo) {
                const baseClass = 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold';
                if (!infoResumo) {
                    return `<span class="${baseClass} bg-gray-100 text-gray-500">Sem registros</span>`;
                }

                if (infoResumo.status === 'concluido') {
                    return `<span class="${baseClass} bg-teal-100 text-teal-700">✅ Concluído</span>`;
                }
                if (infoResumo.status === 'em_andamento') {
                    return `<span class="${baseClass} bg-blue-100 text-blue-700">⏳ Em andamento</span>`;
                }
                return `<span class="${baseClass} bg-yellow-100 text-yellow-700">🕒 Pendente</span>`;
            },

            getProgramacaoResumoPlain(infoResumo, instrucao) {
                if (!infoResumo) {
                    return '';
                }

                const realizados = infoResumo.completas || 0;
                const pendentes = infoResumo.pendentes || 0;
                const iniciados = infoResumo.executado || realizados + pendentes;

                if (infoResumo.quantidade !== null && infoResumo.quantidade > 0) {
                    const unidade = instrucao.unidade ? instrucao.unidade.toLowerCase() : 'registros';
                    const partes = [];
                    partes.push(`${realizados} de ${infoResumo.quantidade} ${unidade} concluído${realizados === 1 ? '' : 's'}`);
                    if (pendentes > 0) {
                        partes.push(`${pendentes} aguardando saída`);
                    }
                    const faltam = Math.max(infoResumo.quantidade - realizados - pendentes, 0);
                    if (faltam > 0) {
                        partes.push(`${faltam} restante${faltam === 1 ? '' : 's'}`);
                    }
                    return partes.join(' • ');
                }

                if (iniciados === 0) {
                    return 'Nenhum registro até o momento';
                }

                const partes = [];
                if (realizados > 0) {
                    partes.push(`${realizados} finalizado${realizados === 1 ? '' : 's'}`);
                }
                if (pendentes > 0) {
                    partes.push(`${pendentes} aguardando saída`);
                }
                return partes.join(' • ');
            },

            getProgramacaoContagemTexto(infoResumo, instrucao) {
                const resumo = this.getProgramacaoResumoPlain(infoResumo, instrucao);
                if (!resumo) {
                    return '';
                }
                return `<p class="text-xs text-gray-500">${resumo}</p>`;
            },

            getProgramacaoProgressBar(infoResumo) {
                if (!infoResumo || infoResumo.progresso === null) {
                    return '';
                }
                const percent = Math.round(infoResumo.progresso * 100);
                const cor = infoResumo.status === 'concluido' ? 'bg-teal-500' : 'bg-teal-300';
                return `
                    <div class="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div class="${cor} h-full" style="width: ${percent}%;"></div>
                    </div>
                `;
            },

            formatarDataCurta(dateStr) {
                if (!dateStr) return '';
                const data = new Date(`${dateStr}T00:00:00`);
                if (Number.isNaN(data.valueOf())) return dateStr;
                const dia = data.toLocaleDateString('pt-BR');
                const semana = data.toLocaleDateString('pt-BR', { weekday: 'short' });
                return `${dia} (${semana})`;
            },

            renderProgramacaoSugestoesEntrada() {
                const container = this.dom.programacaoSugestoesContainer;
                const lista = this.dom.programacaoSugestoesLista;
                if (!container || !lista) return;

                const instrucoes = this.state.programacaoDia || [];
                const dataSelecionada = this.state.programacaoDataSelecionada;

                if (this.dom.programacaoSugestoesTitulo) {
                    const label = dataSelecionada ? this.formatarDataCurta(dataSelecionada) : '—';
                    this.dom.programacaoSugestoesTitulo.textContent = `Sugestões da programação (${label})`;
                }

                if (!dataSelecionada || instrucoes.length === 0) {
                    container.classList.add('hidden');
                    lista.innerHTML = '';
                    return;
                }

                const resumoPorId = new Map((this.state.programacaoResumo || []).map(item => [item.id, item]));
                const pendentes = instrucoes.filter(instrucao => {
                    const info = resumoPorId.get(instrucao.id);
                    return !info || info.status !== 'concluido';
                });

                if (pendentes.length === 0) {
                    container.classList.remove('hidden');
                    lista.innerHTML = `<p class="text-xs text-teal-800 bg-white/80 border border-teal-200 rounded-md px-3 py-2">Todas as instruções foram atendidas para esta data. 🎉</p>`;
                    return;
                }

                lista.innerHTML = pendentes.map(instrucao => {
                    const info = resumoPorId.get(instrucao.id);
                    let resumoTexto = '';
                    if (info) {
                        resumoTexto = this.getProgramacaoResumoPlain(info, instrucao) || 'Nenhum registro até o momento';
                    }

                    return `
                        <div class="rounded-md border border-teal-200 bg-white/90 p-3 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div class="flex-1 text-sm">
                                <p class="font-semibold text-teal-900">📦 ${instrucao.produto}</p>
                                ${instrucao.destino ? `<p class="text-xs text-teal-700 mt-1">🏗️ Destino: ${instrucao.destino}</p>` : ''}
                                ${instrucao.observacao ? `<p class="text-xs text-teal-700 mt-1">📝 ${instrucao.observacao}</p>` : ''}
                                ${resumoTexto ? `<p class="text-[11px] text-teal-600 mt-1">${resumoTexto}</p>` : ''}
                            </div>
                            <div class="flex flex-col items-stretch gap-1 flex-shrink-0 w-full sm:w-auto">
                                <button type="button" class="inline-flex items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50" data-programacao-apply="${instrucao.id}">Aplicar</button>
                                ${info?.pendentes ? `<span class="text-[11px] text-center text-teal-600">${info.pendentes} no pátio</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                container.classList.remove('hidden');
            },

            handleProgramacaoSugestoesRefresh() {
                const hoje = new Date().toISOString().split('T')[0];
                if (this.state.programacaoDataSelecionada !== hoje) {
                    this.handleProgramacaoDateChange(hoje);
                } else {
                    this.renderProgramacaoSugestoesEntrada();
                }
            },

            handleProgramacaoSugestaoClick(e) {
                const button = e.target.closest('button[data-programacao-apply]');
                if (!button) return;
                const id = button.dataset.programacaoApply;
                const instrucao = (this.state.programacaoDia || []).find(item => item.id === id);
                if (!instrucao) return;

                const original = button.textContent;
                button.disabled = true;
                button.textContent = 'Aplicado!';

                this.aplicarSugestaoEntrada(instrucao);

                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = original;
                }, 1500);
            },

            aplicarSugestaoEntrada(instrucao) {
                if (!instrucao || !this.dom.entrada) return;

                if (instrucao.produto) {
                    this.setSelectValueIfMatches(this.dom.entrada.produto, instrucao.produto);
                }

                if (instrucao.destino) {
                    const aplicado = this.tentarAplicarDestinoNaEntrada(instrucao.destino);
                    if (!aplicado && this.dom.entrada.observacao) {
                        const texto = `Destino programado: ${instrucao.destino}`;
                        if (!this.dom.entrada.observacao.value.includes(texto)) {
                            this.dom.entrada.observacao.value = this.dom.entrada.observacao.value
                                ? `${this.dom.entrada.observacao.value}\n${texto}`
                                : texto;
                        }
                    }
                }

                if (instrucao.observacao && this.dom.entrada.observacao) {
                    if (!this.dom.entrada.observacao.value.includes(instrucao.observacao)) {
                        const prefix = this.dom.entrada.observacao.value ? '\n' : '';
                        this.dom.entrada.observacao.value += `${prefix}${instrucao.observacao}`;
                    }
                }

                this.highlightProgramacaoCampos();
            },

            setSelectValueIfMatches(select, alvo, { criarSeAusente = false } = {}) {
                if (!select) return false;
                const alvoNormalizado = this.normalizarTexto(alvo);
                if (!alvoNormalizado) {
                    select.value = '';
                    return false;
                }

                const opcoes = Array.from(select.options);
                let optionEncontrada = opcoes.find(opt => this.normalizarTexto(opt.value || opt.textContent) === alvoNormalizado);
                if (!optionEncontrada) {
                    optionEncontrada = opcoes.find(opt => {
                        const valor = this.normalizarTexto(opt.value || opt.textContent);
                        return valor.includes(alvoNormalizado) || alvoNormalizado.includes(valor);
                    });
                }

                if (optionEncontrada) {
                    select.value = optionEncontrada.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }

                if (criarSeAusente) {
                    const novaOpcao = new Option(alvo, alvo);
                    select.appendChild(novaOpcao);
                    select.value = alvo;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }

                return false;
            },

            tentarAplicarDestinoNaEntrada(destino) {
                const campos = [
                    this.dom.entrada.obra,
                    this.dom.entrada.cliente,
                    this.dom.entrada.transportadora
                ];

                for (const campo of campos) {
                    if (this.setSelectValueIfMatches(campo, destino)) {
                        return true;
                    }
                }
                return false;
            },

            highlightProgramacaoCampos() {
                const campos = [
                    this.dom.entrada?.produto,
                    this.dom.entrada?.obra,
                    this.dom.entrada?.cliente,
                    this.dom.entrada?.transportadora
                ].filter(Boolean);

                campos.forEach(campo => {
                    if (!campo.value) return;
                    campo.classList.add('ring-2', 'ring-teal-400', 'ring-offset-1');
                    setTimeout(() => {
                        campo.classList.remove('ring-2', 'ring-teal-400', 'ring-offset-1');
                    }, 1200);
                });
            },

            openProgramacaoModal(itemId = null) {
                if (!this.canEditProgramacao()) {
                    this.showNotification('❌ Você não tem permissão para alterar a programação.');
                    return;
                }

                this.state.programacaoEditandoId = itemId;
                if (this.dom.programacaoModalTitle) {
                    this.dom.programacaoModalTitle.textContent = itemId ? 'Editar Instrução' : 'Nova Instrução';
                }
                if (this.dom.programacaoDataModal) {
                    this.dom.programacaoDataModal.value = this.state.programacaoDataSelecionada || '';
                }

                this.populateProgramacaoForm(itemId);
                this.dom.modalProgramacao?.classList.add('active');
            },

            populateProgramacaoForm(itemId) {
                if (!this.dom.formProgramacao) return;
                if (!itemId) {
                    this.clearProgramacaoForm();
                    return;
                }

                const instrucao = (this.state.programacaoDia || []).find(item => item.id === itemId);
                if (!instrucao) {
                    this.clearProgramacaoForm();
                    return;
                }

                if (this.dom.programacaoProduto) this.dom.programacaoProduto.value = instrucao.produto || '';
                if (this.dom.programacaoDestino) this.dom.programacaoDestino.value = instrucao.destino || '';
                if (this.dom.programacaoQuantidade) this.dom.programacaoQuantidade.value = instrucao.quantidade ?? '';
                if (this.dom.programacaoUnidade) this.dom.programacaoUnidade.value = instrucao.unidade || '';
                if (this.dom.programacaoObservacao) this.dom.programacaoObservacao.value = instrucao.observacao || '';
            },

            clearProgramacaoForm() {
                if (this.dom.programacaoProduto) this.dom.programacaoProduto.value = '';
                if (this.dom.programacaoDestino) this.dom.programacaoDestino.value = '';
                if (this.dom.programacaoQuantidade) this.dom.programacaoQuantidade.value = '';
                if (this.dom.programacaoUnidade) this.dom.programacaoUnidade.value = '';
                if (this.dom.programacaoObservacao) this.dom.programacaoObservacao.value = '';
            },

            closeProgramacaoModal() {
                this.dom.modalProgramacao?.classList.remove('active');
                this.state.programacaoEditandoId = null;
                this.clearProgramacaoForm();
            },

            async handleProgramacaoSubmit(e) {
                e.preventDefault();
                if (!this.canEditProgramacao()) {
                    this.showNotification('❌ Você não tem permissão para alterar a programação.');
                    return;
                }

                const dataSelecionada = this.state.programacaoDataSelecionada;
                if (!dataSelecionada) {
                    this.showNotification('⚠️ Selecione uma data válida.');
                    return;
                }

                const produto = (this.dom.programacaoProduto?.value ?? '').trim();
                const destinoValor = (this.dom.programacaoDestino?.value ?? '').trim();
                const destino = destinoValor || null;
                const quantidadeValor = (this.dom.programacaoQuantidade?.value ?? '').trim();
                const unidadeValor = (this.dom.programacaoUnidade?.value ?? '').trim();
                const unidade = unidadeValor || null;
                const observacao = (this.dom.programacaoObservacao?.value ?? '').trim();

                if (!produto) {
                    this.showNotification('⚠️ Selecione o produto da programação.');
                    return;
                }

                let quantidade = null;
                if (quantidadeValor) {
                    const parsed = parseFloat(quantidadeValor);
                    if (Number.isNaN(parsed)) {
                        this.showNotification('⚠️ Informe uma quantidade válida.');
                        return;
                    }
                    quantidade = parsed;
                }

                const timestamp = Timestamp.now();
                const usuarioNome = this.state.userDoc?.nome || this.state.currentUser?.email || 'Usuário';

                const instrucoes = (this.state.programacaoDia || []).map(instrucao => ({ ...instrucao }));
                let acao = 'criou_programacao';

                if (this.state.programacaoEditandoId) {
                    const index = instrucoes.findIndex(item => item.id === this.state.programacaoEditandoId);
                    if (index !== -1) {
                        const existente = instrucoes[index];
                        instrucoes[index] = {
                            ...existente,
                            produto,
                            destino,
                            quantidade,
                            unidade,
                            observacao,
                            atualizadoEm: timestamp,
                            atualizadoPorUid: this.state.currentUser.uid,
                            atualizadoPorNome: usuarioNome,
                            atualizadoPorRole: this.state.userRole
                        };
                        acao = 'editou_programacao';
                    }
                } else {
                    instrucoes.push({
                        id: this.generateId(),
                        produto,
                        destino,
                        quantidade,
                        unidade,
                        observacao,
                        criadoEm: timestamp,
                        criadoPorUid: this.state.currentUser.uid,
                        criadoPorNome: usuarioNome,
                        criadoPorRole: this.state.userRole,
                        atualizadoEm: timestamp,
                        atualizadoPorUid: this.state.currentUser.uid,
                        atualizadoPorNome: usuarioNome,
                        atualizadoPorRole: this.state.userRole
                    });
                }

                try {
                    const programacaoRef = doc(this.state.db, 'programacoesDia', dataSelecionada);
                    await setDoc(programacaoRef, {
                        data: dataSelecionada,
                        instrucoes,
                        atualizadoEm: timestamp,
                        atualizadoPorUid: this.state.currentUser.uid,
                        atualizadoPorNome: usuarioNome,
                        atualizadoPorRole: this.state.userRole
                    }, { merge: true });

                    await this.registrarLog(acao, `${acao === 'criou_programacao' ? 'Adicionou' : 'Atualizou'} programação para ${destino || 'destino não informado'}`, {
                        data: dataSelecionada,
                        produto,
                        destino,
                        quantidade,
                        unidade,
                    });

                    this.closeProgramacaoModal();
                    this.showNotification('✅ Programação salva com sucesso!');
                } catch (error) {
                    console.error('❌ Erro ao salvar programação:', error);
                    this.showNotification('❌ Erro ao salvar programação. Tente novamente.');
                }
            },

            handleProgramacaoListaClick(e) {
                const button = e.target.closest('button[data-action]');
                if (!button) return;

                const action = button.dataset.action;
                const id = button.dataset.id;

                if (action === 'edit') {
                    this.openProgramacaoModal(id);
                } else if (action === 'delete') {
                    this.handleProgramacaoDelete(id);
                }
            },

            async handleProgramacaoDelete(itemId) {
                if (!this.canEditProgramacao()) {
                    this.showNotification('❌ Você não tem permissão para remover a programação.');
                    return;
                }

                const instrucao = (this.state.programacaoDia || []).find(item => item.id === itemId);
                if (!instrucao) return;

                if (!confirm('⚠️ Confirmar remoção desta instrução?')) {
                    return;
                }

                const restantes = (this.state.programacaoDia || []).filter(item => item.id !== itemId);
                const timestamp = Timestamp.now();
                const usuarioNome = this.state.userDoc?.nome || this.state.currentUser?.email || 'Usuário';

                try {
                    const programacaoRef = doc(this.state.db, 'programacoesDia', this.state.programacaoDataSelecionada);
                    if (restantes.length === 0) {
                        await deleteDoc(programacaoRef);
                    } else {
                        await setDoc(programacaoRef, {
                            data: this.state.programacaoDataSelecionada,
                            instrucoes: restantes,
                            atualizadoEm: timestamp,
                            atualizadoPorUid: this.state.currentUser.uid,
                            atualizadoPorNome: usuarioNome,
                            atualizadoPorRole: this.state.userRole
                        }, { merge: true });
                    }

                    await this.registrarLog('removeu_programacao', `Removeu programação para ${instrucao.destino || 'destino não informado'}`, {
                        data: this.state.programacaoDataSelecionada,
                        produto: instrucao.produto,
                        destino: instrucao.destino,
                        quantidade: instrucao.quantidade,
                        unidade: instrucao.unidade
                    });

                    this.showNotification('✅ Programação removida.');
                } catch (error) {
                    console.error('❌ Erro ao remover programação:', error);
                    this.showNotification('❌ Não foi possível remover a programação.');
                }
            },

            generateId() {
                if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
                    return window.crypto.randomUUID();
                }
                return `prog_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
            },

            formatRoleLabel(role) {
                const labels = {
                    dono: 'Proprietário',
                    operador: 'Operador',
                    visualizador: 'Visualizador'
                };
                return labels[role] || '';
            },

            toDate(value) {
                if (!value) return null;
                if (value instanceof Date) return value;
                if (value.seconds) return new Date(value.seconds * 1000);
                if (typeof value === 'string') return new Date(value);
                return null;
            },

            formatQuantidade(valor) {
                if (valor === null || valor === undefined || valor === '') return '';
                const numero = Number(valor);
                if (Number.isNaN(numero)) return '';
                const formatador = new Intl.NumberFormat('pt-BR', {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: numero % 1 === 0 ? 0 : 2
                });
                return formatador.format(numero);
            },

            getRoleBadgeHTML(role) {
                const badges = {
                    dono: '<span class="user-badge badge-dono">👑 Proprietário</span>',
                    operador: '<span class="user-badge badge-operador">⚖️ Operador</span>',
                    visualizador: '<span class="user-badge badge-visualizador">👁️ Visualizador</span>'
                };
                return badges[role] || '';
            },

            applyRolePermissions() {
                console.log("🔍 Aplicando permissões...");
                console.log("👤 Role atual:", this.state.userRole);
                
                // Ocultar/mostrar elementos baseado no role
                const donoOnlyElements = document.querySelectorAll('.dono-only');
                const operadorOnlyElements = document.querySelectorAll('.operador-only');
                const visualizadorOnlyElements = document.querySelectorAll('.visualizador-only');
                
                if (this.state.userRole === 'dono') {
                    console.log("👑 Usuário é DONO - Ocultando botão de promoção");
                    donoOnlyElements.forEach(el => el.classList.remove('hidden'));
                    operadorOnlyElements.forEach(el => el.classList.remove('hidden'));
                    visualizadorOnlyElements.forEach(el => el.classList.add('hidden'));
                    this.dom.btnRequestPromo?.classList.add('hidden');
                } else if (this.state.userRole === 'operador') {
                    console.log("⚖️ Usuário é OPERADOR - Ocultando botão de promoção");
                    donoOnlyElements.forEach(el => el.classList.add('hidden'));
                    operadorOnlyElements.forEach(el => el.classList.remove('hidden'));
                    visualizadorOnlyElements.forEach(el => el.classList.add('hidden'));
                    this.dom.btnRequestPromo?.classList.add('hidden');
                } else {
                    // Visualizador
                    console.log("👁️ Usuário é VISUALIZADOR - Mostrando botão de promoção");
                    donoOnlyElements.forEach(el => el.classList.add('hidden'));
                    operadorOnlyElements.forEach(el => el.classList.add('hidden'));
                    visualizadorOnlyElements.forEach(el => el.classList.remove('hidden'));
                    
                    if (this.dom.btnRequestPromo) {
                        this.dom.btnRequestPromo.classList.remove('hidden');
                        console.log("✅ Botão de promoção agora está visível");
                    } else {
                        console.error("❌ Botão btnRequestPromo não encontrado no DOM!");
                    }
                }
                
                // Atualizar também o updateUIAccess existente
                this.updateUIAccess();
                this.updateProgramacaoControls();
                this.renderProgramacaoDia();
            },

            async handleSetDono() {
                const email = this.dom.inputEmailDono.value.trim();
                
                if (!email) {
                    alert("⚠️ Digite um email válido");
                    return;
                }
                
                if (!confirm(`⚠️ Confirmar definir ${email} como Proprietário?\n\nEsta ação não pode ser desfeita!`)) {
                    return;
                }
                
                try {
                    // Atualizar config
                    await setDoc(doc(this.state.db, 'config', 'system'), {
                        emailDono: email
                    });
                    
                    // Buscar usuário por email e promover para dono
                    const usersQuery = query(collection(this.state.db, 'users'), where('email', '==', email));
                    const usersSnapshot = await getDocs(usersQuery);
                    
                    if (!usersSnapshot.empty) {
                        const userDoc = usersSnapshot.docs[0];
                        await updateDoc(doc(this.state.db, 'users', userDoc.id), {
                            role: 'dono'
                        });
                    }
                    
                    alert("✅ Proprietário definido com sucesso!");
                    await this.loadDonoEmail();
                    this.loadUsers();
                } catch (error) {
                    console.error("❌ Erro ao definir dono:", error);
                    alert("❌ Erro ao definir proprietário");
                }
            },

            async loadUsers() {
                try {
                    const usersSnapshot = await getDocs(collection(this.state.db, 'users'));
                    const users = [];
                    
                    usersSnapshot.forEach(doc => {
                        users.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Ordenar: Dono primeiro, depois por data de criação
                    users.sort((a, b) => {
                        if (a.role === 'dono') return -1;
                        if (b.role === 'dono') return 1;
                        return b.criadoEm?.seconds - a.criadoEm?.seconds;
                    });
                    
                    this.renderUsersTable(users);
                } catch (error) {
                    console.error("❌ Erro ao carregar usuários:", error);
                }
            },

            renderUsersTable(users) {
                if (!this.dom.usersTableBody) return;
                
                this.dom.usersTableBody.innerHTML = '';
                
                users.forEach(user => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b hover:bg-gray-50';
                    
                    const isDono = user.role === 'dono';
                    const isCurrentUser = user.uid === this.state.currentUser.uid;
                    
                    tr.innerHTML = `
                        <td class="p-3">${user.nome}</td>
                        <td class="p-3">${user.email}</td>
                        <td class="p-3">${this.getRoleBadgeHTML(user.role)}</td>
                        <td class="p-3">${user.criadoEm ? new Date(user.criadoEm.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A'}</td>
                        <td class="p-3">
                            <span class="px-2 py-1 text-xs font-semibold rounded ${user.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                ${user.ativo ? '✅ Ativo' : '❌ Inativo'}
                            </span>
                        </td>
                        <td class="p-3">
                            <span class="px-2 py-1 text-xs font-semibold rounded ${user.canEditProgramacao ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-500'}">
                                ${user.canEditProgramacao ? 'Liberado' : 'Restrito'}
                            </span>
                        </td>
                        <td class="p-3 text-center">
                            ${!isDono && !isCurrentUser ? `
                                ${user.role === 'visualizador' ? `
                                    <button onclick="App.handleToggleProgramacaoPermissao('${user.id}', ${user.canEditProgramacao ? 'true' : 'false'}, '${user.nome.replace(/'/g, "\\'")}', '${user.email.replace(/'/g, "\\'")}')"
                                            class="${user.canEditProgramacao ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-teal-500 text-white hover:bg-teal-600'} px-3 py-1 rounded text-sm font-semibold mr-2">
                                        ${user.canEditProgramacao ? '🔒 Revogar Programação' : '📝 Liberar Programação'}
                                    </button>
                                ` : ''}
                                <button onclick="App.openChangeRoleModal('${user.id}', '${user.nome}', '${user.email}', '${user.role}')" 
                                        class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm font-semibold mr-2">
                                    🎭 Alterar
                                </button>
                                <button onclick="App.handleToggleUserStatus('${user.id}', ${user.ativo})" 
                                        class="${user.ativo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white px-3 py-1 rounded text-sm font-semibold">
                                    ${user.ativo ? '🚫 Desativar' : '✅ Ativar'}
                                </button>
                            ` : '<span class="text-gray-400 text-sm">—</span>'}
                        </td>
                    `;
                    
                    this.dom.usersTableBody.appendChild(tr);
                });
            },

            openChangeRoleModal(userId, userName, userEmail, currentRole) {
                this.state.userIdToChange = userId;
                document.getElementById('modal-user-name').textContent = userName;
                document.getElementById('modal-user-email').textContent = userEmail;
                this.dom.selectNewRole.value = currentRole;
                this.dom.modalChangeRole?.classList.add('active');
            },

            async handleConfirmChangeRole() {
                const newRole = this.dom.selectNewRole.value;
                const userName = document.getElementById('modal-user-name').textContent;
                const userEmail = document.getElementById('modal-user-email').textContent;
                
                try {
                    await updateDoc(doc(this.state.db, 'users', this.state.userIdToChange), {
                        role: newRole
                    });
                    
                    // Registrar log
                    await this.registrarLog('mudou_permissao', `Alterou permissão de ${userName} (${userEmail}) para ${newRole}`, {
                        usuarioAlteradoId: this.state.userIdToChange,
                        usuarioAlteradoNome: userName,
                        usuarioAlteradoEmail: userEmail,
                        novoRole: newRole
                    });
                    
                    alert("✅ Nível de acesso alterado com sucesso!");
                    this.dom.modalChangeRole?.classList.remove('active');
                    this.loadUsers();
                } catch (error) {
                    console.error("❌ Erro ao alterar role:", error);
                    alert("❌ Erro ao alterar nível de acesso");
                }
            },

            async handleToggleUserStatus(userId, currentStatus) {
                const newStatus = !currentStatus;
                const action = newStatus ? 'ativar' : 'desativar';
                
                if (!confirm(`⚠️ Confirmar ${action} este usuário?`)) {
                    return;
                }
                
                try {
                    await updateDoc(doc(this.state.db, 'users', userId), {
                        ativo: newStatus
                    });
                    
                    alert(`✅ Usuário ${action === 'ativar' ? 'ativado' : 'desativado'} com sucesso!`);
                    this.loadUsers();
                } catch (error) {
                    console.error("❌ Erro ao alterar status:", error);
                    alert("❌ Erro ao alterar status do usuário");
                }
            },

            async handleToggleProgramacaoPermissao(userId, currentValue, userName = '', userEmail = '') {
                const atual = currentValue === true || currentValue === 'true';
                const habilitar = !atual;
                const acao = habilitar ? 'habilitar' : 'revogar';

                if (!confirm(`⚠️ Confirmar ${acao} acesso à programação para ${userName || 'este usuário'}?`)) {
                    return;
                }

                try {
                    await updateDoc(doc(this.state.db, 'users', userId), {
                        canEditProgramacao: habilitar
                    });

                    await this.registrarLog('alterou_programacao_permissao', `${habilitar ? 'Habilitou' : 'Revogou'} edição de programação para ${userName || userEmail || userId}`, {
                        usuarioAlvoId: userId,
                        usuarioAlvoNome: userName,
                        usuarioAlvoEmail: userEmail,
                        habilitado: habilitar
                    });

                    this.showNotification(habilitar ? '✅ Permissão concedida.' : '✅ Permissão revogada.');
                    this.loadUsers();
                } catch (error) {
                    console.error('❌ Erro ao alterar permissão de programação:', error);
                    this.showNotification('❌ Erro ao alterar permissão. Tente novamente.');
                }
            },

            async requestPromotion() {
                const password = this.dom.promotionPasswordInput.value.trim();
                const SENHA_SECRETA = '01928374'; // Senha mestra para promoção
                
                if (!password) {
                    this.dom.promotionError.textContent = '⚠️ Digite a senha.';
                    return;
                }
                
                const btnSubmit = this.dom.btnConfirmPromotion;
                btnSubmit.disabled = true;
                btnSubmit.textContent = '⏳ Verificando...';
                
                try {
                    // Verificar senha
                    if (password !== SENHA_SECRETA) {
                        this.dom.promotionError.textContent = '❌ Senha incorreta!';
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = '✅ Confirmar';
                        return;
                    }
                    
                    // Promover usuário para operador
                    const userRef = doc(this.state.db, 'users', this.state.currentUser.uid);
                    await updateDoc(userRef, {
                        role: 'operador'
                    });
                    
                    // Registrar promoção no histórico
                    await addDoc(collection(this.state.db, 'promotion_history'), {
                        uid: this.state.currentUser.uid,
                        email: this.state.currentUser.email,
                        nome: this.state.userDoc.nome,
                        timestamp: Timestamp.now(),
                        method: 'self-promotion'
                    });
                    
                    console.log("✅ Promoção realizada com sucesso");
                    alert('✅ Promoção realizada com sucesso!\n\n🎉 Você agora é um Operador!\n\nFaça logout e login novamente para atualizar suas permissões.');
                    
                    // Fechar modal
                    this.dom.promotionModal.classList.remove('active');
                    this.dom.promotionPasswordInput.value = '';
                    this.dom.promotionError.textContent = '';
                    
                    // Fazer logout automático
                    await signOut(this.state.auth);
                    window.location.reload();
                    
                } catch (error) {
                    console.error('❌ Erro ao solicitar promoção:', error);
                    
                    if (error.code === 'permission-denied') {
                        this.dom.promotionError.textContent = '❌ Erro de permissão. Entre em contato com o proprietário.';
                    } else {
                        this.dom.promotionError.textContent = '❌ Erro ao solicitar promoção.';
                    }
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = '✅ Confirmar';
                }
            },

            async handleLogout() {
                if (!confirm("🚪 Deseja realmente sair?")) return;
                
                try {
                    // Registrar log antes de deslogar
                    await this.registrarLog('logout', 'Usuário saiu do sistema');

                    if (this.state.unsubscribeProgramacao) {
                        this.state.unsubscribeProgramacao();
                        this.state.unsubscribeProgramacao = null;
                    }
                    if (this.state.unsubscribeUserDoc) {
                        this.state.unsubscribeUserDoc();
                        this.state.unsubscribeUserDoc = null;
                    }
                    
                    await signOut(this.state.auth);
                    console.log("✅ Logout realizado");
                    window.location.reload();
                } catch (error) {
                    console.error("❌ Erro ao fazer logout:", error);
                }
            },

            getAuthErrorMessage(errorCode) {
                const messages = {
                    'auth/email-already-in-use': 'Este email já está em uso',
                    'auth/invalid-email': 'Email inválido',
                    'auth/operation-not-allowed': 'Operação não permitida',
                    'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres)',
                    'auth/user-disabled': 'Esta conta foi desativada',
                    'auth/user-not-found': 'Usuário não encontrado',
                    'auth/wrong-password': 'Senha incorreta',
                    'auth/invalid-credential': 'Credenciais inválidas',
                    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde'
                };
                return messages[errorCode] || 'Erro desconhecido';
            },

            handleAdminLogout() {
                this.state.isAdmin = false;
                this.updateUIAccess();
            },

            showNotification(message, actions = []) {
                this.dom.notificationMessage.textContent = message;
                const actionsContainer = document.getElementById('notification-actions');
                
                actionsContainer.innerHTML = '';

                actions.forEach(action => {
                    const button = document.createElement('button');
                    button.id = action.id;
                    button.textContent = action.text;
                    button.className = action.class;
                    actionsContainer.appendChild(button);
                });

                const okButton = document.createElement('button');
                okButton.textContent = 'OK';
                okButton.className = 'btn-primary text-white font-semibold py-2 px-6 rounded-md';
                okButton.addEventListener('click', () => {
                    this.dom.modalNotification.classList.remove('active');
                });
                actionsContainer.appendChild(okButton);

                // Adicionar animação ao modal
                this.dom.modalNotification.classList.add('active');
                const modalContent = this.dom.modalNotification.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.classList.add('animate-scale-in');
                    setTimeout(() => modalContent.classList.remove('animate-scale-in'), 400);
                }
            },

            renderConfig() { 
                const { nome, cnpj, footer, color, logo, password } = this.state.config;
                this.dom.configNomeInput.value = nome; 
                this.dom.configCnpjInput.value = cnpj; 
                this.dom.configFooterInput.value = footer;
                this.dom.configPasswordInput.value = password;
                this.dom.configColorInput.value = color;
                document.documentElement.style.setProperty('--color-accent', color);

                this.dom.headerNomeEmpresa.textContent = nome;

                if (logo) {
                    this.dom.headerLogo.src = logo;
                    this.dom.headerLogo.classList.remove('hidden');
                    this.dom.headerDefaultIcon.classList.add('hidden');
                    this.dom.logoPreview.src = logo;
                    this.dom.logoPreviewContainer.classList.remove('hidden');
                } else {
                    this.dom.headerLogo.classList.add('hidden');
                    this.dom.headerDefaultIcon.classList.remove('hidden');
                    this.dom.logoPreviewContainer.classList.add('hidden');
                }
            },
            renderFooter() { 
                const year = new Date().getFullYear(); 
                this.dom.footer.innerHTML = `<p>&copy; ${year} ${this.state.config.nome}.</p><p class="text-xs text-gray-400 mt-1">Criado por Eullon</p>`; 
            },
            
            renderGenericList(listName, tableBodyId, selectIds = []) {
                const list = this.state[listName] || [];
                const sortedList = [...list].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
                const tableBody = document.getElementById(tableBodyId);
                if (tableBody) {
                    tableBody.innerHTML = sortedList.map((item) => `
                        <tr class="border-b border-gray-200 hover:bg-gray-50">
                            <td class="p-3">${item}</td>
                            <td class="p-3 text-right">
                                <button class="text-red-500 hover:text-red-700 p-1" data-item="${item}" title="Excluir">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }

                selectIds.forEach(selectId => {
                    const select = document.getElementById(selectId);
                    if (select) {
                        const currentValue = select.value;
                        select.innerHTML = '<option value="">Selecione</option>' + sortedList.map(item => `<option value="${item}">${item}</option>`).join('');
                        select.value = currentValue;
                    }
                });
            },

            renderFiltros() {
                const fornecedores = [...(this.state.fornecedores || [])].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
                const obras = [...(this.state.obras || [])].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
                const transportadoras = [...(this.state.transportadoras || [])].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
                const produtos = [...(this.state.produtos || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

                const populateSelect = (select, data, valueKey, textKey, allOptionText = 'Todos') => {
                    if (!select) return;
                    const currentValue = select.value;
                    select.innerHTML = `<option value="">${allOptionText}</option>` + data.map(item => `<option value="${item[valueKey]}">${item[textKey]}</option>`).join('');
                    select.value = currentValue;
                };

                populateSelect(this.dom.filtroFornecedor, fornecedores.map(name => ({ name })), 'name', 'name');
                populateSelect(this.dom.filtroProduto, produtos, 'nome', 'nome');
                populateSelect(this.dom.filtroObra, obras.map(name => ({ name })), 'name', 'name');
                populateSelect(this.dom.filtroTransportadora, transportadoras.map(name => ({ name })), 'name', 'name');
                populateSelect(this.dom.filtroTicketProduto, produtos, 'nome', 'nome', 'Todos Produtos');
                populateSelect(this.dom.filtroTicketObra, obras.map(name => ({ name })), 'name', 'name', 'Todas Obras');
                populateSelect(this.dom.filtroTicketCliente, fornecedores.map(name => ({ name })), 'name', 'name', 'Todos Clientes');
                populateSelect(this.dom.filtroTicketTransportadora, transportadoras.map(name => ({ name })), 'name', 'name', 'Todas Transportadoras');
                populateSelect(this.dom.dbFiltroFornecedor, fornecedores.map(name => ({ name })), 'name', 'name', 'Todos Fornecedores');
                populateSelect(this.dom.dbFiltroProduto, produtos, 'nome', 'nome', 'Todos Produtos');
                populateSelect(this.dom.dbFiltroTransportadora, transportadoras.map(name => ({ name })), 'name', 'name', 'Todas Transportadoras');
                
                // Filtros da aba Saída
                populateSelect(this.dom.saidaFiltroFornecedor, fornecedores.map(name => ({ name })), 'name', 'name');
                populateSelect(this.dom.saidaFiltroProduto, produtos, 'nome', 'nome');
            },

            renderFornecedores() {
                this.renderGenericList('fornecedores', 'tabela-fornecedores', ['entrada-cliente']);
                this.renderFiltros();
            },
            renderTransportadoras() {
                this.renderGenericList('transportadoras', 'tabela-transportadoras', ['entrada-transportadora']);
                this.renderFiltros();
            },
            renderRazoesSociais() {
                this.renderGenericList('razoesSociais', 'tabela-razoes-sociais', ['entrada-razao-social']);
                this.renderFiltros();
            },
            renderObras() {
                const obras = [...(this.state.obras || [])].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
                this.renderGenericList('obras', 'tabela-obras', ['entrada-obra']);
                if (this.dom.programacaoDestino) {
                    const currentDestino = this.dom.programacaoDestino.value;
                    this.dom.programacaoDestino.innerHTML = '<option value="">Selecione</option>' + obras.map(o => `<option value="${o}">${o}</option>`).join('');
                    if (currentDestino && obras.includes(currentDestino)) {
                        this.dom.programacaoDestino.value = currentDestino;
                    }
                }
                this.renderFiltros();
            },
            
            renderProdutos() {
                const list = [...(this.state.produtos || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
                this.dom.tabelaProdutos.innerHTML = list.map(p => `
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                        <td class="p-3">${p.nome}</td>
                        <td class="p-3 text-gray-600">${p.certificado || 'N/A'}</td>
                        <td class="p-3 text-right">
                            <button class="text-red-500 hover:text-red-700 p-1" data-item="${p.nome}" title="Excluir">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a 1 1 0 012 0v6a 1 1 0 11-2 0V8z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                        </td>
                    </tr>
                `).join('');

                const entradaSelect = this.dom.entrada.produto;
                if (entradaSelect) {
                    const currentValue = entradaSelect.value;
                    entradaSelect.innerHTML = '<option value="">Selecione</option>' + list.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
                    entradaSelect.value = currentValue;
                }

                if (this.dom.programacaoProduto) {
                    const currentProgValue = this.dom.programacaoProduto.value;
                    this.dom.programacaoProduto.innerHTML = '<option value="">Selecione</option>' + list.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
                    if (currentProgValue && list.some(p => p.nome === currentProgValue)) {
                        this.dom.programacaoProduto.value = currentProgValue;
                    }
                }

                this.renderFiltros();
            },

            getFilteredPesagens() {
                const termo = this.dom.filtroPesquisaInput.value.toLowerCase();
                const produto = this.dom.filtroProduto.value;
                const fornecedor = this.dom.filtroFornecedor.value;
                const transportadora = this.dom.filtroTransportadora.value;
                const certificado = this.dom.filtroCertificado.value.toLowerCase();
                const obra = this.dom.filtroObra.value;
                const motorista = this.dom.filtroMotorista.value.toLowerCase();
                const dataInicio = this.dom.filtroDataInicio.value ? new Date(this.dom.filtroDataInicio.value + 'T00:00:00') : null;
                const dataFim = this.dom.filtroDataFim.value ? new Date(this.dom.filtroDataFim.value + 'T23:59:59') : null;

                let resultados = this.state.pesagensCompletas.filter(p => {
                    const dataPesagem = new Date(p.dataEntrada.seconds * 1000);
                    const notaFiscalPrimaria = (p.notaFiscal || '').toLowerCase();
                    const notaFiscalSecundaria = (p.notaFiscal2 || '').toLowerCase();

                    return (termo === '' || String(p.placa).toLowerCase().includes(termo) || notaFiscalPrimaria.includes(termo) || notaFiscalSecundaria.includes(termo)) &&
                           (produto === '' || p.produto === produto) &&
                           (fornecedor === '' || p.cliente === fornecedor) &&
                           (transportadora === '' || p.transportadora === transportadora) &&
                           (certificado === '' || (p.certificado || '').toLowerCase().includes(certificado)) &&
                           (obra === '' || p.obra === obra) &&
                           (motorista === '' || (p.motorista || '').toLowerCase().includes(motorista)) &&
                           (!dataInicio || dataPesagem >= dataInicio) &&
                           (!dataFim || dataPesagem <= dataFim);
                });

                // Aplicar Filtros Avançados
                resultados = this.aplicarFiltrosAvancados(resultados);

                return resultados.sort((a, b) => b.dataEntrada.seconds - a.dataEntrada.seconds);
            },
            renderRelatorios() {
                const pesagensFiltradas = this.getFilteredPesagens();
                const totalItems = pesagensFiltradas.length;
                const currentPage = this.state.reportsCurrentPage;
                const itemsPerPage = this.state.itemsPerPage;
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const itemsParaPagina = pesagensFiltradas.slice(startIndex, endIndex);

                if (this.dom.relatorioPeriodoText) {
                    const dataInicio = this.dom.filtroDataInicio.value;
                    const dataFim = this.dom.filtroDataFim.value;
                    if (dataInicio && dataFim) {
                        this.dom.relatorioPeriodoText.textContent = `📅 ${new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR')}`;
                    } else if (dataInicio) {
                        this.dom.relatorioPeriodoText.textContent = `📅 A partir de ${new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR')}`;
                    } else if (dataFim) {
                        this.dom.relatorioPeriodoText.textContent = `📅 Até ${new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR')}`;
                    } else {
                        this.dom.relatorioPeriodoText.textContent = '📅 Todos os períodos';
                    }
                }

                const divergencias = this.detectarDivergencias(pesagensFiltradas);
                const metrics = this.computeRelatorioMetrics(pesagensFiltradas);

                this.dom.tabelaRelatorios.innerHTML = itemsParaPagina.length > 0 ? itemsParaPagina.map(p => `
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                        <td class="p-3">${p.num}</td><td class="p-3">${new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR')}</td>
                        <td class="p-3">${p.placa}</td><td class="p-3 text-gray-500">${this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2)}</td><td class="p-3">${p.cliente || 'N/A'}</td>
                        <td class="p-3">${p.transportadora || 'N/A'}</td><td class="p-3">${p.obra || 'N/A'}</td><td class="p-3">${p.produto}</td>
                        <td class="p-3 text-gray-500">${p.certificado || 'N/A'}</td><td class="p-3 text-right font-semibold">${this.formatarPeso(p.pesoLiquido)} kg</td>
                    </tr>`).join('') : '<tr><td colspan="10" class="p-4 text-center text-gray-500">Nenhum registo encontrado.</td></tr>';
                
                if (pesagensFiltradas.length > 0) {
                    this.dom.relatorioTotalLiquido.textContent = `${this.formatarPeso(metrics.totalLiquido)} kg`;
                    this.dom.relatorioTotalTickets.textContent = pesagensFiltradas.length;
                    this.dom.relatorioSummary.classList.remove('hidden');
                } else {
                    this.dom.relatorioSummary.classList.add('hidden');
                }

                this.renderRelatorioInsights(pesagensFiltradas, metrics);
                this.renderRelatorioTransportadoras(pesagensFiltradas, metrics);
                this.renderPagination('reports', this.dom.relatoriosPagination, totalItems, currentPage, itemsPerPage);
            },
            computeRelatorioMetrics(pesagens) {
                const baseMetrics = {
                    totalBruto: 0,
                    totalTara: 0,
                    totalLiquido: 0,
                    mediaLiquido: 0,
                    transportadoras: {},
                    topTransportadora: null
                };
                if (!Array.isArray(pesagens) || pesagens.length === 0) {
                    return baseMetrics;
                }

                const aggregated = pesagens.reduce((acc, pesagem) => {
                    const bruto = Number(pesagem.pesoBruto) || 0;
                    const tara = Number(pesagem.tara) || 0;
                    const liquido = Number(pesagem.pesoLiquido) || 0;
                    acc.totalBruto += bruto;
                    acc.totalTara += tara;
                    acc.totalLiquido += liquido;

                    const key = (pesagem.transportadora && pesagem.transportadora.trim()) ? pesagem.transportadora.trim() : 'Sem Transportadora';
                    if (!acc.transportadoras[key]) {
                        acc.transportadoras[key] = { viagens: 0, pesoLiquido: 0, pesoBruto: 0 };
                    }
                    acc.transportadoras[key].viagens += 1;
                    acc.transportadoras[key].pesoLiquido += liquido;
                    acc.transportadoras[key].pesoBruto += bruto;
                    return acc;
                }, { ...baseMetrics });

                aggregated.mediaLiquido = aggregated.totalLiquido / pesagens.length;

                aggregated.topTransportadora = Object.entries(aggregated.transportadoras)
                    .sort(([, a], [, b]) => b.pesoLiquido - a.pesoLiquido)[0] || null;

                return aggregated;
            },
            renderRelatorioInsights(pesagens, metrics = null) {
                if (!this.dom.relatorioInsights) return;
                if (!metrics) metrics = this.computeRelatorioMetrics(pesagens);

                if (!pesagens.length) {
                    this.dom.relatorioInsights.classList.add('hidden');
                    this.dom.relatorioTotalBruto.textContent = '0,00 kg';
                    this.dom.relatorioTotalTara.textContent = '0,00 kg';
                    this.dom.relatorioMediaLiquido.textContent = '0,00 kg';
                    this.dom.relatorioTopTransportadora.textContent = 'Sem dados';
                    return;
                }

                this.dom.relatorioTotalBruto.textContent = `${this.formatarPeso(metrics.totalBruto)} kg`;
                this.dom.relatorioTotalTara.textContent = `${this.formatarPeso(metrics.totalTara)} kg`;
                this.dom.relatorioMediaLiquido.textContent = `${this.formatarPeso(metrics.mediaLiquido)} kg`;
                if (metrics.topTransportadora) {
                    const [nome, info] = metrics.topTransportadora;
                    const display = nome === 'Sem Transportadora' ? 'Sem transportadora' : nome;
                    this.dom.relatorioTopTransportadora.textContent = `${display} (${this.formatarPeso(info.pesoLiquido)} kg)`;
                } else {
                    this.dom.relatorioTopTransportadora.textContent = 'Sem dados';
                }
                this.dom.relatorioInsights.classList.remove('hidden');
            },
            renderRelatorioTransportadoras(pesagens, metrics = null) {
                if (!this.dom.relatorioAgrupamentos || !this.dom.relatorioTransportadoraBody) return;
                if (!metrics) metrics = this.computeRelatorioMetrics(pesagens);

                if (!pesagens.length) {
                    this.dom.relatorioTransportadoraBody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-gray-500">Sem dados para exibir.</td></tr>';
                    this.dom.relatorioAgrupamentos.classList.add('hidden');
                    return;
                }

                const rows = Object.entries(metrics.transportadoras)
                    .sort(([, a], [, b]) => b.pesoLiquido - a.pesoLiquido)
                    .map(([nome, valores]) => {
                        const displayNome = nome === 'Sem Transportadora' ? 'Sem transportadora' : nome;
                        return `<tr class="border-b border-gray-200 last:border-b-0"><td class="p-3">${displayNome}</td><td class="p-3 text-right">${valores.viagens}</td><td class="p-3 text-right">${this.formatarPeso(valores.pesoLiquido)} kg</td><td class="p-3 text-right">${this.formatarPeso(valores.pesoBruto)} kg</td></tr>`;
                    }).join('');

                this.dom.relatorioTransportadoraBody.innerHTML = rows || '<tr><td colspan="4" class="p-3 text-center text-gray-500">Sem dados para exibir.</td></tr>';
                this.dom.relatorioAgrupamentos.classList.remove('hidden');
            },
            getFilteredTickets() {
                const termo = this.dom.filtroTicketPesquisa.value.toLowerCase();
                const produto = this.dom.filtroTicketProduto.value;
                const obra = this.dom.filtroTicketObra.value;
                const cliente = this.dom.filtroTicketCliente.value;
                const transportadora = this.dom.filtroTicketTransportadora.value;
                const dataInicio = this.dom.filtroTicketDataInicio.value ? new Date(this.dom.filtroTicketDataInicio.value + 'T00:00:00') : null;
                const dataFim = this.dom.filtroTicketDataFim.value ? new Date(this.dom.filtroTicketDataFim.value + 'T23:59:59') : null;

                return this.state.pesagensCompletas.filter(p => {
                    const dataPesagem = new Date(p.dataEntrada.seconds * 1000);
                    const nfPrimaria = (p.notaFiscal || '').toLowerCase();
                    const nfSecundaria = (p.notaFiscal2 || '').toLowerCase();

                    return (termo === '' || String(p.placa).toLowerCase().includes(termo) || String(p.num).includes(termo) || nfPrimaria.includes(termo) || nfSecundaria.includes(termo)) &&
                           (produto === '' || p.produto === produto) &&
                           (obra === '' || p.obra === obra) &&
                           (cliente === '' || p.cliente === cliente) &&
                           (transportadora === '' || p.transportadora === transportadora) &&
                           (!dataInicio || dataPesagem >= dataInicio) &&
                           (!dataFim || dataPesagem <= dataFim);
                }).sort((a, b) => b.num - a.num);
            },
            renderTickets() {
                // Mostrar skeleton durante o carregamento
                this.showTableSkeleton(this.dom.tabelaTickets, 5);
                
                setTimeout(() => {
                    const ticketsFiltrados = this.getFilteredTickets();
                    const totalItems = ticketsFiltrados.length;
                    const currentPage = this.state.ticketsCurrentPage;
                    const itemsPerPage = this.state.itemsPerPage;
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const itemsParaPagina = ticketsFiltrados.slice(startIndex, endIndex);

                    this.dom.tabelaTickets.innerHTML = itemsParaPagina.length > 0 ? itemsParaPagina.map(p => {
                    const nfTooltip = this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2).replace(/"/g, '&quot;');
                    return `
                    <tr class="border-b border-gray-200 hover:bg-gray-50" title="NF: ${nfTooltip}">
                        <td class="p-3">${p.num}</td><td class="p-3">${new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR')}</td>
                        <td class="p-3">${p.placa}</td><td class="p-3">${p.produto}</td><td class="p-3">${p.transportadora || 'N/A'}</td>
                        <td class="p-3 text-center space-x-2">
                            <button class="text-accent hover:brightness-125 font-semibold" data-action="view" data-id="${p.id}">Visualizar</button>
                            <button class="admin-only text-blue-500 hover:text-blue-700 font-semibold" data-action="edit" data-id="${p.id}">Alterar</button>
                            <button class="admin-only text-red-500 hover:text-red-700 font-semibold" data-action="delete" data-id="${p.id}">Apagar</button>
                        </td>
                    </tr>`;
                }).join('') : '<tr><td colspan="6" class="p-4 text-center text-gray-500">Nenhum ticket encontrado.</td></tr>';

                    this.renderPagination('tickets', this.dom.ticketsPagination, totalItems, currentPage, itemsPerPage);
                    
                    // Adicionar animação fade-in nas linhas
                    this.dom.tabelaTickets.querySelectorAll('tr').forEach((row, index) => {
                        row.style.animationDelay = `${index * 0.05}s`;
                        row.classList.add('animate-fade-in');
                    });
                }, 100);
            },
            limparFiltrosSaida() {
                if (this.dom.saidaPesquisaPlaca) this.dom.saidaPesquisaPlaca.value = '';
                if (this.dom.saidaFiltroData) this.dom.saidaFiltroData.value = '';
                if (this.dom.saidaFiltroFornecedor) this.dom.saidaFiltroFornecedor.value = '';
                if (this.dom.saidaFiltroProduto) this.dom.saidaFiltroProduto.value = '';
                this.renderPendentes();
            },

            renderPendentes() {
                const pendentes = Array.isArray(this.state.pesagensPendentes) ? this.state.pesagensPendentes : [];
                const termoSaida = (this.dom.saidaPesquisaPlaca?.value || '').trim().toLowerCase();

                if (this.dom.listaPendentes) {
                    const filtroData = this.dom.saidaFiltroData?.value;
                    const filtroFornecedor = this.dom.saidaFiltroFornecedor?.value;
                    const filtroProduto = this.dom.saidaFiltroProduto?.value;

                    const pendentesSaida = pendentes.filter(p => {
                        const matchPlaca = (p.placa || '').toLowerCase().includes(termoSaida);
                        
                        let matchData = true;
                        if (filtroData) {
                            const dateObj = p.dataEntrada ? (p.dataEntrada.seconds ? new Date(p.dataEntrada.seconds * 1000) : new Date(p.dataEntrada)) : null;
                            if (dateObj) {
                                // Ajustar para o fuso horário local para comparação de data YYYY-MM-DD
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                const formattedObj = `${year}-${month}-${day}`;
                                matchData = formattedObj === filtroData;
                            } else {
                                matchData = false;
                            }
                        }

                        let matchFornecedor = true;
                        if (filtroFornecedor) {
                            const fornecedorNome = typeof p.cliente === 'string' ? p.cliente : (p.cliente?.nome || '');
                            matchFornecedor = fornecedorNome === filtroFornecedor;
                        }

                        let matchProduto = true;
                        if (filtroProduto) {
                            const produtoNome = typeof p.produto === 'string' ? p.produto : (p.produto?.nome || '');
                            matchProduto = produtoNome === filtroProduto;
                        }

                        return matchPlaca && matchData && matchFornecedor && matchProduto;
                    });

                    this.dom.listaPendentes.innerHTML = pendentesSaida.length > 0 ? pendentesSaida.map(p => {
                        const produto = typeof p.produto === 'string' ? p.produto : (p.produto?.nome || 'N/A');
                        const cliente = typeof p.cliente === 'string' ? p.cliente : (p.cliente?.nome || 'N/A');
                        const obra = typeof p.obra === 'string' ? p.obra : (p.obra?.nome || 'N/A');
                        const transportadora = p.transportadora ? (typeof p.transportadora === 'string' ? p.transportadora : p.transportadora?.nome) : null;
                        const notaFiscal = p.notaFiscal || p.nf || 'Sem NF';
                        const dataEntradaTexto = p.dataEntrada ? (p.dataEntrada.seconds ? new Date(p.dataEntrada.seconds * 1000) : new Date(p.dataEntrada)) : null;
                        const dataEntradaFormatada = dataEntradaTexto ? dataEntradaTexto.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Data não disponível';

                        return `
                        <div class="p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-start gap-4">
                                <div class="cursor-pointer flex-grow" data-id="${p.id}">
                                    <div class="flex items-center gap-3 mb-2">
                                        <span class="text-2xl">🚛</span>
                                        <div>
                                            <div class="font-bold text-xl text-gray-800">${p.placa}</div>
                                            <div class="text-sm text-gray-500">👤 ${p.motorista || 'Motorista não informado'}</div>
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded">
                                        <div><span class="text-gray-600">📦 Produto:</span> <span class="font-semibold text-gray-800">${produto}</span></div>
                                        <div><span class="text-gray-600">🏢 Cliente:</span> <span class="font-semibold text-gray-800">${cliente}</span></div>
                                        <div><span class="text-gray-600">🏗️ Obra:</span> <span class="font-semibold text-gray-800">${obra}</span></div>
                                        ${transportadora ? `<div><span class="text-gray-600">🚛 Transportadora:</span> <span class="font-semibold text-gray-800">${transportadora}</span></div>` : ''}
                                        <div><span class="text-gray-600">📄 NF:</span> <span class="font-semibold text-gray-800">${notaFiscal}</span></div>
                                        <div><span class="text-gray-600">⏰ Entrada:</span> <span class="font-semibold text-gray-800">${dataEntradaFormatada}</span></div>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-2 flex-shrink-0">
                                    <button data-action="alterar-entrada" data-id="${p.id}" class="text-sm bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold py-2 px-4 rounded-md transition-colors whitespace-nowrap">
                                        ✏️ Alterar
                                    </button>
                                    <button data-action="visualizar-entrada" data-id="${p.id}" class="text-sm bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md transition-colors whitespace-nowrap">
                                        👁️ Visualizar
                                    </button>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('') : '<div class="text-center text-gray-500 py-8"><p class="text-lg">🚗 Nenhum veículo aguardando saída</p><p class="text-sm mt-2">Os veículos que fizeram apenas a entrada aparecerão aqui</p></div>';
                }

                if (this.dom.visualizadorListaPendentes) {
                    const termoViewer = (this.dom.visualizadorPesquisaPlaca?.value || '').trim().toLowerCase();
                    const ordenacao = this.dom.visualizadorOrdenacao?.value || 'entrada-recente';
                    
                    let viewerPendentes = termoViewer === ''
                        ? [...pendentes]
                        : pendentes.filter(p => {
                            const placa = (p.placa || '').toLowerCase();
                            const motorista = (p.motorista || '').toLowerCase();
                            const nf1 = (p.notaFiscal || p.nf || '').toLowerCase();
                            const nf2 = (p.notaFiscal2 || '').toLowerCase();
                            const produtoNome = (typeof p.produto === 'string' ? p.produto : p.produto?.nome || '').toLowerCase();
                            const clienteNome = (typeof p.cliente === 'string' ? p.cliente : p.cliente?.nome || '').toLowerCase();
                            const obraNome = (typeof p.obra === 'string' ? p.obra : p.obra?.nome || '').toLowerCase();
                            const transportadoraNome = p.transportadora ? (typeof p.transportadora === 'string' ? p.transportadora : p.transportadora?.nome || '').toLowerCase() : '';
                            return placa.includes(termoViewer) || motorista.includes(termoViewer) || nf1.includes(termoViewer) ||
                                   nf2.includes(termoViewer) || produtoNome.includes(termoViewer) || clienteNome.includes(termoViewer) ||
                                   obraNome.includes(termoViewer) || transportadoraNome.includes(termoViewer);
                        });

                    // Aplicar ordenação
                    switch (ordenacao) {
                        case 'entrada-recente':
                            viewerPendentes.sort((a, b) => {
                                const dateA = a.dataEntrada?.seconds || 0;
                                const dateB = b.dataEntrada?.seconds || 0;
                                return dateB - dateA; // Mais recente primeiro
                            });
                            break;
                        case 'entrada-antiga':
                            viewerPendentes.sort((a, b) => {
                                const dateA = a.dataEntrada?.seconds || 0;
                                const dateB = b.dataEntrada?.seconds || 0;
                                return dateA - dateB; // Mais antigo primeiro (PRIORIDADE)
                            });
                            break;
                        case 'produto':
                            viewerPendentes.sort((a, b) => {
                                const prodA = (typeof a.produto === 'string' ? a.produto : a.produto?.nome || '').toLowerCase();
                                const prodB = (typeof b.produto === 'string' ? b.produto : b.produto?.nome || '').toLowerCase();
                                return prodA.localeCompare(prodB);
                            });
                            break;
                        case 'placa':
                            viewerPendentes.sort((a, b) => {
                                const placaA = (a.placa || '').toLowerCase();
                                const placaB = (b.placa || '').toLowerCase();
                                return placaA.localeCompare(placaB);
                            });
                            break;
                        case 'tempo-patio':
                            viewerPendentes.sort((a, b) => {
                                const dateA = a.dataEntrada?.seconds || 0;
                                const dateB = b.dataEntrada?.seconds || 0;
                                return dateA - dateB; // Mais antigo = mais tempo no pátio
                            });
                            break;
                    }

                    if (this.dom.visualizadorResumoTotal) {
                        this.dom.visualizadorResumoTotal.textContent = pendentes.length.toString();
                    }

                    this.dom.visualizadorListaPendentes.innerHTML = viewerPendentes.length > 0 ? viewerPendentes.map(p => {
                        const produto = typeof p.produto === 'string' ? p.produto : (p.produto?.nome || 'N/A');
                        const cliente = typeof p.cliente === 'string' ? p.cliente : (p.cliente?.nome || 'N/A');
                        const obra = typeof p.obra === 'string' ? p.obra : (p.obra?.nome || 'N/A');
                        const transportadora = p.transportadora ? (typeof p.transportadora === 'string' ? p.transportadora : p.transportadora?.nome) : null;
                        const notaFiscal = typeof this.formatarNotasFiscais === 'function'
                            ? this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2)
                            : (p.notaFiscal || p.nf || 'Sem NF');
                        const dataEntradaDate = p.dataEntrada ? (p.dataEntrada.seconds ? new Date(p.dataEntrada.seconds * 1000) : new Date(p.dataEntrada)) : null;
                        const dataEntradaFormatada = dataEntradaDate ? dataEntradaDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Data não disponível';

                        let tempoPatioHtml = '';
                        if (dataEntradaDate instanceof Date && !Number.isNaN(dataEntradaDate.getTime())) {
                            const diffMs = Date.now() - dataEntradaDate.getTime();
                            if (Number.isFinite(diffMs) && diffMs >= 0) {
                                const diffMinutes = Math.floor(diffMs / 60000);
                                const horas = Math.floor(diffMinutes / 60);
                                const minutos = diffMinutes % 60;
                                const tempoTexto = horas > 0 ? `${horas}h ${minutos.toString().padStart(2, '0')}min` : `${minutos}min`;
                                tempoPatioHtml = `<span class="text-xs text-gray-500">Tempo no pátio: ${tempoTexto}</span>`;
                            }
                        }

                        const pesoTotal = Number(p.peso1);
                        let pesoEntradaTexto = '';
                        if (Number.isFinite(pesoTotal) && pesoTotal > 0) {
                            if (p.isPesagemDupla) {
                                const eixo1 = Number(p.peso1_eixo1);
                                const eixo2 = Number(p.peso1_eixo2);
                                const partes = [];
                                if (Number.isFinite(eixo1) && eixo1 > 0) {
                                    partes.push(`Eixo 1: ${this.formatarPeso(eixo1)} kg`);
                                }
                                if (Number.isFinite(eixo2) && eixo2 > 0) {
                                    partes.push(`Eixo 2: ${this.formatarPeso(eixo2)} kg`);
                                }
                                pesoEntradaTexto = partes.length ? partes.join(' • ') : `${this.formatarPeso(pesoTotal)} kg`;
                            } else {
                                pesoEntradaTexto = `${this.formatarPeso(pesoTotal)} kg`;
                            }
                        }
                        const pesoEntradaHtml = pesoEntradaTexto ? `<div><span class="text-gray-600">⚖️ 1ª Pesagem:</span> <span class="font-semibold text-gray-800">${pesoEntradaTexto}</span></div>` : '';

                        const pesoNota = Number(p.pesoNota);
                        const pesoNotaHtml = Number.isFinite(pesoNota) && pesoNota > 0
                            ? `<div><span class="text-gray-600">🧾 Peso Nota:</span> <span class="font-semibold text-gray-800">${this.formatarPeso(pesoNota)} kg</span></div>`
                            : '';

                        const observacao = (p.observacao || '').trim();
                        const observacaoHtml = observacao ? `<div class="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">📝 ${observacao}</div>` : '';

                        return `
                        <div class="p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div class="flex items-center gap-3 mb-2">
                                        <span class="text-2xl">🚛</span>
                                        <div>
                                            <div class="font-bold text-xl text-gray-800">${p.placa}</div>
                                            <div class="text-sm text-gray-500">Motorista: ${p.motorista || 'Não informado'}</div>
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded">
                                        <div><span class="text-gray-600">📦 Produto:</span> <span class="font-semibold text-gray-800">${produto}</span></div>
                                        <div><span class="text-gray-600">🏢 Cliente:</span> <span class="font-semibold text-gray-800">${cliente}</span></div>
                                        <div><span class="text-gray-600">🏗️ Obra:</span> <span class="font-semibold text-gray-800">${obra}</span></div>
                                        ${transportadora ? `<div><span class="text-gray-600">🚛 Transportadora:</span> <span class="font-semibold text-gray-800">${transportadora}</span></div>` : ''}
                                        <div><span class="text-gray-600">📄 NF:</span> <span class="font-semibold text-gray-800">${notaFiscal}</span></div>
                                        ${pesoEntradaHtml}
                                        ${pesoNotaHtml}
                                    </div>
                                </div>
                                <div class="flex flex-col items-end gap-2">
                                    <span class="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">Entrada: ${dataEntradaFormatada}</span>
                                    ${tempoPatioHtml}
                                </div>
                            </div>
                            ${observacaoHtml}
                        </div>
                        `;
                    }).join('') : '<div class="text-center text-gray-500 py-8 border border-dashed border-gray-300 rounded-lg bg-gray-50"><p class="text-lg">✅ Nenhum veículo aguardando saída agora</p><p class="text-sm mt-2">Assim que um veículo realizar a entrada, ele aparecerá aqui automaticamente.</p></div>';
                }
            },
            renderDashboard() { 
                // Mostrar skeleton loaders
                this.showStatsSkeleton(true);
                
                const filtroFornecedor = this.dom.dbFiltroFornecedor.value;
                const filtroProduto = this.dom.dbFiltroProduto.value;
                const filtroTransportadora = this.dom.dbFiltroTransportadora.value;

                const dadosFiltrados = this.state.pesagensCompletas.filter(p => {
                    const matchFornecedor = !filtroFornecedor || p.cliente === filtroFornecedor;
                    const matchProduto = !filtroProduto || p.produto === filtroProduto;
                    const matchTransportadora = !filtroTransportadora || (p.transportadora || '') === filtroTransportadora;
                    return matchFornecedor && matchProduto && matchTransportadora;
                });

                const hoje = new Date().toISOString().split('T')[0];
                const pesagensHoje = dadosFiltrados.filter(p => p.dataEntrada && p.dataEntrada.seconds && new Date(p.dataEntrada.seconds * 1000).toISOString().split('T')[0] === hoje);
                
                const totalPesagensHoje = pesagensHoje.length;
                const pesoLiquidoHoje = pesagensHoje.reduce((sum, p) => sum + p.pesoLiquido, 0);
                const veiculosPatio = this.state.pesagensPendentes.length;
                const totalLiquidoGeral = dadosFiltrados.reduce((sum, p) => sum + p.pesoLiquido, 0);
                const totalPesagensGeral = dadosFiltrados.length;
                const ticketMedio = totalPesagensGeral > 0 ? totalLiquidoGeral / totalPesagensGeral : 0;

                // Animar contadores
                this.animateCounter(this.dom.dbStatPesagensHoje, totalPesagensHoje);
                this.animateCounter(this.dom.dbStatVeiculosPatio, veiculosPatio);
                
                this.dom.dbStatPesagensHoje.textContent = totalPesagensHoje;
                this.dom.dbStatPesoHoje.textContent = `${this.formatarPeso(pesoLiquidoHoje)} kg`;
                this.dom.dbStatVeiculosPatio.textContent = veiculosPatio;
                this.dom.dbStatTicketMedio.textContent = `${this.formatarPeso(ticketMedio)} kg`;

                this.renderChartPesoProduto(dadosFiltrados);
                this.renderChartPesagensDia(dadosFiltrados); 
                this.renderDashboardTopProdutos(dadosFiltrados);
                this.renderDashboardUltimasPesagens(dadosFiltrados);
            },
            renderChartPesoProduto(dados) {
                if (!this.dom.chartPesoProduto) return;
                const ctx = this.dom.chartPesoProduto.getContext('2d');
                const data = dados.reduce((acc, p) => { acc[p.produto] = (acc[p.produto] || 0) + p.pesoLiquido; return acc; }, {});
                const labels = Object.keys(data);
                const values = Object.values(data);

                const generateColors = (numColors) => {
                    const colors = [];
                    for (let i = 0; i < numColors; i++) {
                        const hue = (i * (360 / (numColors * 1.618))) % 360;
                        colors.push(`hsla(${hue}, 70%, 60%, 0.8)`);
                    }
                    return colors;
                };
                
                if (this.state.charts.pesoProduto) this.state.charts.pesoProduto.destroy();
                this.state.charts.pesoProduto = new Chart(ctx, { 
                    type: 'doughnut', 
                    data: { 
                        labels: labels, 
                        datasets: [{ 
                            label: 'Peso Líquido (kg)', 
                            data: values, 
                            backgroundColor: generateColors(labels.length),
                            borderColor: '#fff',
                            borderWidth: 2
                        }] 
                    }, 
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { padding: 15, boxWidth: 12 } } }
                    } 
                });
            },
            renderChartPesagensDia(dados) {
                if (!this.dom.chartPesagensDia) return;
                const ctx = this.dom.chartPesagensDia.getContext('2d');
                const data = dados.reduce((acc, p) => { if (p.dataEntrada && p.dataEntrada.seconds) { const date = new Date(p.dataEntrada.seconds * 1000).toISOString().split('T')[0]; acc[date] = (acc[date] || 0) + 1; } return acc; }, {});
                const last7Days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().split('T')[0]; }).reverse();
                const chartData = last7Days.map(date => data[date] || 0);
                
                const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight);
                gradient.addColorStop(0, 'rgba(13, 148, 136, 0.5)');   
                gradient.addColorStop(1, 'rgba(13, 148, 136, 0)');
                
                if (this.state.charts.pesagensDia) this.state.charts.pesagensDia.destroy();
                this.state.charts.pesagensDia = new Chart(ctx, { 
                    type: 'line', 
                    data: { 
                        labels: last7Days.map(d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})), 
                        datasets: [{ 
                            label: 'Nº de Pesagens', 
                            data: chartData, 
                            fill: true, 
                            borderColor: 'rgb(13, 148, 136)', 
                            backgroundColor: gradient,
                            tension: 0.3,
                            pointBackgroundColor: 'rgb(13, 148, 136)',
                            pointBorderColor: '#fff',
                            pointHoverRadius: 6,
                            pointRadius: 4,
                        }] 
                    }, 
                    options: { 
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { 
                            y: { 
                                beginAtZero: true, 
                                ticks: { stepSize: 1, precision: 0 } 
                            }, 
                            x: { grid: { display: false } }
                        } 
                    } 
                });
            },
            switchTab(tabName) {
                this.dom.tabContents.forEach(c => c.classList.remove('active'));
                this.dom.tabButtons.forEach(b => b.classList.remove('active'));
                const activeTab = document.getElementById(`tab-content-${tabName}`);
                const activeButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
                if(activeTab) activeTab.classList.add('active');
                if(activeButton) activeButton.classList.add('active');
                if (tabName === 'dashboard') this.renderDashboard();
                
                // NOVO: Carregar logs ao acessar aba de atividades
                if (tabName === 'atividades' && this.state.userRole === 'dono') {
                    this.carregarUsuariosParaFiltro();
                    this.carregarLogs();
                }
            },
            renderPagination(section, container, totalItems, currentPage, itemsPerPage) {
                container.innerHTML = '';
                if (totalItems <= itemsPerPage) return;

                const totalPages = Math.ceil(totalItems / itemsPerPage);
                const pageButtons = [];

                pageButtons.push(`<button class="px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 hover:bg-gray-100'}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`);

                const pageNumbers = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
                let lastPage = 0;
                const sortedPages = Array.from(pageNumbers).sort((a, b) => a - b).filter(p => p > 0 && p <= totalPages);

                for (const page of sortedPages) {
                    if (page > lastPage + 1) {
                        pageButtons.push(`<span class="px-3 py-1 text-sm text-gray-500">...</span>`);
                    }
                    pageButtons.push(`<button class="px-3 py-1 rounded-md text-sm font-medium ${page === currentPage ? 'bg-accent text-white border-accent' : 'bg-white border border-gray-300 hover:bg-gray-100'}" data-page="${page}">${page}</button>`);
                    lastPage = page;
                }

                pageButtons.push(`<button class="px-3 py-1 rounded-md text-sm font-medium ${currentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 hover:bg-gray-100'}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Próxima</button>`);

                container.innerHTML = `<div class="flex items-center gap-1">${pageButtons.join('')}</div>`;

                container.querySelectorAll('button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const newPage = parseInt(e.currentTarget.dataset.page, 10);
                        if (!isNaN(newPage)) {
                             if (section === 'tickets') { this.state.ticketsCurrentPage = newPage; this.renderTickets(); } 
                             else if (section === 'reports') { this.state.reportsCurrentPage = newPage; this.renderRelatorios(); }
                        }
                    });
                });
            },
            async handleFecharConfig() { 
                const newConfig = { 
                    ...this.state.config, 
                    nome: this.dom.configNomeInput.value, 
                    cnpj: this.dom.configCnpjInput.value,
                    footer: this.dom.configFooterInput.value,
                    color: this.dom.configColorInput.value,
                    password: this.dom.configPasswordInput.value,
                };
                const configRef = doc(this.state.db, 'app_state', 'config');
                await setDoc(configRef, newConfig, { merge: true });
                this.dom.modalConfig.classList.remove('active'); 
            },
            handleLogoUpload(e) {
                const file = e.target.files[0];
                if (!file || !file.type.startsWith('image/')) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const logoBase64 = event.target.result;
                    const configRef = doc(this.state.db, 'app_state', 'config');
                    await setDoc(configRef, { logo: logoBase64 }, { merge: true });
                };
                reader.readAsDataURL(file);
            },
            async handleLogoRemove() {
                const configRef = doc(this.state.db, 'app_state', 'config');
                await setDoc(configRef, { logo: '' }, { merge: true });
            },
            async handleGenericAdd(e, listName, inputId) { 
                e.preventDefault(); 
                const input = document.getElementById(inputId);
                if (input.value && !this.state[listName].includes(input.value)) {
                    const cadastrosRef = doc(this.state.db, 'app_state', 'cadastros');
                    await updateDoc(cadastrosRef, { [listName]: arrayUnion(input.value) });
                    
                    // Registrar log do cadastro
                    const tiposLog = {
                        'fornecedores': 'cadastrou_fornecedor',
                        'transportadoras': 'cadastrou_transportadora',
                        'obras': 'cadastrou_obra'
                    };
                    const tipoAcao = tiposLog[listName];
                    if (tipoAcao) {
                        await this.registrarLog(tipoAcao, { nome: input.value });
                    }
                    
                    input.value = '';
                }
            },
            async handleGenericDelete(e, listName) { 
                const button = e.target.closest('button');
                if (button) { 
                    const item = button.dataset.item;
                    const cadastrosRef = doc(this.state.db, 'app_state', 'cadastros');
                    await updateDoc(cadastrosRef, { [listName]: arrayRemove(item) });
                    
                    // Registrar log da exclusão
                    const tiposNomes = {
                        'fornecedores': 'Fornecedor',
                        'transportadoras': 'Transportadora',
                        'obras': 'Obra',
                        'produtos': 'Produto'
                    };
                    const tipoNome = tiposNomes[listName] || listName;
                    await this.registrarLog('deletou_cadastro', { tipo: tipoNome, nome: item });
                } 
            },
            async handleProdutoAdd(e) {
                e.preventDefault();
                const nomeInput = document.getElementById('nome-produto');
                const certInput = this.dom.certificadoProdutoInput;
                const nome = nomeInput.value.trim();
                const certificado = certInput.value.trim();

                if (nome && !this.state.produtos.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
                    const novoProduto = { nome, certificado };
                    const cadastrosRef = doc(this.state.db, 'app_state', 'cadastros');
                    await updateDoc(cadastrosRef, { produtos: arrayUnion(novoProduto) });
                    
                    // Registrar log do cadastro
                    await this.registrarLog('cadastrou_produto', { nome, certificado });
                    
                    nomeInput.value = '';
                    certInput.value = '';
                }
            },
            async handleProdutoDelete(e) {
                const button = e.target.closest('button');
                if (button) {
                    const nomeParaExcluir = button.dataset.item;
                    const produtoParaExcluir = this.state.produtos.find(p => p.nome === nomeParaExcluir);
                    if (produtoParaExcluir) {
                        const cadastrosRef = doc(this.state.db, 'app_state', 'cadastros');
                        await updateDoc(cadastrosRef, { produtos: arrayRemove(produtoParaExcluir) });
                        
                        // Registrar log da exclusão
                        await this.registrarLog('deletou_cadastro', { tipo: 'Produto', nome: nomeParaExcluir });
                    }
                }
            },
            handlePlacaBlur(e) {
                const placa = e.target.value.trim().toUpperCase();
                if (placa.length < 7) return;

                const ultimaPesagem = [...this.state.pesagensCompletas]
                    .sort((a, b) => b.dataEntrada.seconds - a.dataEntrada.seconds)
                    .find(p => p.placa === placa);

                if (ultimaPesagem) {
                    this.dom.entrada.motorista.value = ultimaPesagem.motorista || '';
                    this.dom.entrada.produto.value = ultimaPesagem.produto || '';
                    this.dom.entrada.obra.value = ultimaPesagem.obra || '';
                    this.dom.entrada.cliente.value = ultimaPesagem.cliente || '';
                    this.dom.entrada.transportadora.value = ultimaPesagem.transportadora || '';

                    const fields = [this.dom.entrada.motorista, this.dom.entrada.produto, this.dom.entrada.obra, this.dom.entrada.cliente, this.dom.entrada.transportadora];
                    fields.forEach(field => {
                        if(field.value) {
                            field.classList.add('bg-teal-50', 'border-accent');
                            setTimeout(() => field.classList.remove('bg-teal-50', 'border-accent'), 2500);
                        }
                    });
                    
                    this.showNotification(`Dados da última pesagem da placa ${placa} preenchidos.`);
                }
            },
            handleExportarBackup() {
                try {
                    const backupData = {
                        version: '1.3',
                        timestamp: new Date().toISOString(),
                        app_state: {
                           config: this.state.config,
                           cadastros: {
                               fornecedores: this.state.fornecedores,
                               transportadoras: this.state.transportadoras,
                               produtos: this.state.produtos,
                               obras: this.state.obras,
                           }
                        },
                        pesagensCompletas: this.state.pesagensCompletas,
                        pesagensPendentes: this.state.pesagensPendentes,
                    };
                    const jsonString = JSON.stringify(backupData, null, 2);
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    const date = new Date().toISOString().slice(0, 10);
                    link.download = `backup_balanca_${date}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                    this.showNotification("✅ Backup exportado com sucesso!");
                } catch (error) {
                    console.error("Erro ao exportar backup:", error);
                    this.showNotification("❌ Erro ao gerar ficheiro de backup.");
                }
            },
            handleBackupFileSelected(e) {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (data && (data.version === '1.3' || data.version === '1.2') && data.pesagensCompletas) {
                            this.state.pendingBackupData = data;
                            this.dom.restoreConfirmInput.value = '';
                            this.dom.btnConfirmRestore.disabled = true;
                            this.dom.modalConfirmRestore.classList.add('active');
                        } else {
                            this.showNotification("Erro: Ficheiro de backup inválido ou incompatível.");
                        }
                    } catch (error) {
                        this.showNotification("Erro ao ler o ficheiro de backup.");
                        console.error("Erro no parse do JSON:", error);
                    }
                };
                reader.readAsText(file);
                e.target.value = '';
            },

            async handleConfirmRestore() {
                const backupData = this.state.pendingBackupData;
                if (!backupData) return;

                const loadingOverlay = document.getElementById('loading-overlay');
                loadingOverlay.querySelector('p').textContent = 'A restaurar backup...';
                loadingOverlay.style.display = 'flex';
                loadingOverlay.style.opacity = '1';

                try {
                    const db = this.state.db;
                    const batch = writeBatch(db);

                    for (const pesagem of this.state.pesagensCompletas) { batch.delete(doc(db, 'pesagensCompletas', pesagem.id)); }
                    for (const pesagem of this.state.pesagensPendentes) { batch.delete(doc(db, 'pesagensPendentes', pesagem.id)); }

                    let configData, cadastrosData;
                    if(backupData.version === '1.3') { // New structure
                        configData = backupData.app_state.config;
                        cadastrosData = backupData.app_state.cadastros;
                    } else { // Old structure v1.2
                        configData = backupData.config;
                        cadastrosData = backupData.cadastros;
                    }

                    cadastrosData.transportadoras = cadastrosData.transportadoras || [];

                    batch.set(doc(db, 'app_state', 'config'), configData);
                    batch.set(doc(db, 'app_state', 'cadastros'), cadastrosData);

                    const toTimestamp = (ts) => {
                        if (!ts) return new Date();
                        if (ts.seconds) return new Date(ts.seconds * 1000);
                        return new Date(ts);
                    };

                    backupData.pesagensCompletas.forEach(p_with_id => {
                        const { id, ...p } = p_with_id;
                        p.dataEntrada = toTimestamp(p.dataEntrada);
                        p.dataSaida = toTimestamp(p.dataSaida);
                        batch.set(doc(collection(db, `pesagensCompletas`)), p);
                    });
                     backupData.pesagensPendentes.forEach(p_with_id => {
                        const { id, ...p } = p_with_id;
                        p.dataEntrada = toTimestamp(p.dataEntrada);
                        batch.set(doc(collection(db, `pesagensPendentes`)), p);
                    });

                    await batch.commit();

                    this.state.pendingBackupData = null;
                    this.dom.modalConfirmRestore.classList.remove('active');
                    this.dom.modalConfig.classList.remove('active');
                    this.showNotification("✅ Backup restaurado! A aplicação irá recarregar.");

                    setTimeout(() => window.location.reload(), 3000);

                } catch (error) {
                    console.error("Erro ao restaurar backup:", error);
                    this.showNotification("❌ Falha ao restaurar o backup.");
                } finally {
                     loadingOverlay.style.opacity = '0';
                      setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
                }
            },
            async handleEntradaSubmit(e) {
                e.preventDefault();

                if (this.state.isSubmittingEntrada) { return; }
                
                if (!window.confirm('Confirmar registro da entrada?')) { return; }

                const submitButton = this.dom.formEntrada.querySelector('button[type="submit"]');
                const originalButtonText = submitButton ? submitButton.textContent : '';

                this.state.isSubmittingEntrada = true;
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = 'Salvando...';
                }

                try {
                    const isPesagemDupla = this.dom.checkPesagemDupla.checked;
                    const peso1eixo1Val = parseFloat(this.dom.entrada.peso1eixo1.value);
                    const peso1eixo2Val = isPesagemDupla ? parseFloat(this.dom.entrada.peso1eixo2.value) : 0;

                    if (Number.isNaN(peso1eixo1Val) || (isPesagemDupla && Number.isNaN(peso1eixo2Val))) {
                        this.showNotification('⚠️ Informe os valores de pesagem corretamente.');
                        return;
                    }

                    const nomeProduto = this.dom.entrada.produto.value;
                    const produtoInfo = this.state.produtos.find(p => p.nome === nomeProduto);
                    const pesoNotaValue = this.dom.entrada.pesoNota.value;
                    const notaFiscalValue = this.dom.entrada.nf.value.trim();
                    const notaFiscal2Value = this.dom.entrada.nf2.value.trim();

                    if (this.dom.entrada.hasNf2.checked && notaFiscal2Value === '') {
                        this.showNotification('⚠️ Informe a 2ª Nota Fiscal ou desmarque a opção.');
                        return;
                    }

                    const pendente = {
                        dataEntrada: new Date(),
                        placa: this.dom.entrada.placa.value.toUpperCase(),
                        motorista: this.dom.entrada.motorista.value,
                        notaFiscal: notaFiscalValue === '' ? '*' : notaFiscalValue,
                        notaFiscal2: notaFiscal2Value !== '' ? notaFiscal2Value : null,
                        pesoNota: pesoNotaValue ? parseFloat(pesoNotaValue) : null,
                        produto: nomeProduto,
                        cliente: this.dom.entrada.cliente.value,
                        transportadora: this.dom.entrada.transportadora.value.trim(),
                        razaoSocial: this.dom.entrada.razaoSocial.value.trim(),
                        obra: this.dom.entrada.obra.value,
                        certificado: produtoInfo ? (produtoInfo.certificado || '') : '',
                        isPesagemDupla: isPesagemDupla,
                        peso1_eixo1: peso1eixo1Val,
                        peso1_eixo2: isPesagemDupla ? peso1eixo2Val : null,
                        peso1: peso1eixo1Val + peso1eixo2Val,
                        observacao: this.dom.entrada.observacao.value.trim()
                    };

                    const pendentesRef = collection(this.state.db, 'pesagensPendentes');
                    const docRef = await addDoc(pendentesRef, pendente);
                    pendente.id = docRef.id;

                    // Registrar log
                    await this.registrarLog('criou_entrada', `Registrou entrada do veículo ${pendente.placa} - Produto: ${pendente.produto}`, {
                        pendenteId: docRef.id,
                        placa: pendente.placa,
                        produto: pendente.produto,
                        peso: pendente.peso1
                    });

                    this.showNotification("✅ Entrada salva!", [
                        { text: '🖨️ Imprimir Comprovante', id: 'btn-print-entry-ticket', class: 'bg-slate-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-slate-700' }
                    ]);

                    document.getElementById('btn-print-entry-ticket')?.addEventListener('click', () => {
                        this.state.currentTicket = pendente;
                        this.preencherTicketEntrada(pendente);
                        this.dom.modalNotification.classList.remove('active');
                        this.dom.modalTicket.classList.add('active');
                    });

                    this.dom.formEntrada.reset();
                    this.dom.containerPeso1Eixo2.classList.add('hidden');
                    this.dom.entrada.peso1eixo2.required = false;
                    this.dom.entrada.peso1eixo1.previousElementSibling.textContent = '1ª Pesagem (kg)';
                    this.dom.entrada.hasNf2.checked = false;
                    this.dom.entradaNf2Container.classList.add('hidden');
                    this.dom.entrada.nf2.required = false;
                    this.dom.entrada.nf2.value = '';
                } catch (error) {
                    console.error('Erro ao salvar entrada:', error);
                    this.showNotification('❌ Falha ao salvar a entrada. Tente novamente.');
                } finally {
                    this.state.isSubmittingEntrada = false;
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = originalButtonText || 'Salvar Entrada';
                    }
                }
            },
            handlePendenteSelect(e) {
                const button = e.target.closest('button[data-action]');
                if (button) {
                    const action = button.dataset.action;
                    const id = button.dataset.id;
                    if (action === 'alterar-entrada') {
                        this.handleEditTicket(id, true); // true indica que é uma pesagem pendente
                    } else if (action === 'visualizar-entrada') {
                        this.handleVisualizarEntrada(id);
                    }
                    return; // Impede que o clique no botão selecione o item
                }

                const target = e.target.closest('[data-id]');
                if (!target) return;
                const id = target.dataset.id;
                const pendente = this.state.pesagensPendentes.find(p => p.id === id);
                if (!pendente) return;
                
                const peso1Detalhes = pendente.isPesagemDupla 
                    ? `Eixo 1: ${this.formatarPeso(pendente.peso1_eixo1)} kg + Eixo 2: ${this.formatarPeso(pendente.peso1_eixo2)} kg`
                    : `${this.formatarPeso(pendente.peso1)} kg`;

                const camposSaida = pendente.isPesagemDupla
                    ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label for="saida-peso2-eixo1" class="text-sm font-medium text-gray-700">2ª Pesagem - Eixo 1 (kg)</label><input type="number" step="0.01" id="saida-peso2-eixo1" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required></div>
                            <div><label for="saida-peso2-eixo2" class="text-sm font-medium text-gray-700">2ª Pesagem - Eixo 2 (kg)</label><input type="number" step="0.01" id="saida-peso2-eixo2" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required></div>
                        </div>`
                    : `<div><label for="saida-peso2" class="text-sm font-medium text-gray-700">2ª Pesagem (kg)</label><input type="number" step="0.01" id="saida-peso2" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required></div>`;


                this.dom.formSaidaContainer.classList.remove('hidden');
                this.dom.formSaida.innerHTML = `
                    <input type="hidden" id="saida-id" value="${pendente.id}">
                    <p class="text-lg font-semibold text-gray-800">Finalizando Pesagem: <span class="text-accent">${pendente.placa}</span></p>
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-800">
                            <div><p class="text-sm text-gray-600">Motorista</p><p>${pendente.motorista}</p></div>
                            <div><p class="text-sm text-gray-600">Produto</p><p>${pendente.produto}</p></div>
                            <div class="sm:col-span-2"><p class="text-sm text-gray-600">Nota Fiscal</p><p>${this.formatarNotasFiscais(pendente.notaFiscal, pendente.notaFiscal2)}</p></div>
                        </div>
                        <div><p class="text-sm text-gray-600">1ª Pesagem Total</p><p class="font-semibold">${peso1Detalhes}</p></div>
                        ${camposSaida}
                    </div>
                    <div class="flex justify-end gap-3 pt-4"><button type="submit" id="btn-finalizar-saida" class="btn-primary text-white font-semibold py-2 px-4 rounded-md">Finalizar e Gerar Ticket</button></div>
                `;
                this.dom.formSaida.onsubmit = (ev) => this.handleSaidaSubmit(ev);
            },
            async handleSaidaSubmit(e) {
                e.preventDefault();
                const submitButton = document.getElementById('btn-finalizar-saida');
                if (submitButton.disabled) return;

                try {
                    submitButton.disabled = true;
                    submitButton.textContent = 'A processar...';

                    const id = document.getElementById('saida-id').value;
                    const pendente = this.state.pesagensPendentes.find(p => p.id === id);
                    if (!pendente) { throw new Error("Pesagem pendente não encontrada."); }

                    let peso2, peso2_eixo1 = null, peso2_eixo2 = null;

                    if (pendente.isPesagemDupla) {
                        peso2_eixo1 = parseFloat(document.getElementById('saida-peso2-eixo1').value);
                        peso2_eixo2 = parseFloat(document.getElementById('saida-peso2-eixo2').value);
                        if (isNaN(peso2_eixo1) || isNaN(peso2_eixo2)) return;
                        peso2 = peso2_eixo1 + peso2_eixo2;
                    } else {
                        peso2 = parseFloat(document.getElementById('saida-peso2').value);
                        if (isNaN(peso2)) return;
                    }

                    const pesoBruto = Math.max(pendente.peso1, peso2);
                    const tara = Math.min(pendente.peso1, peso2);
                    
                    const maxNum = this.state.pesagensCompletas.reduce((max, p) => Math.max(max, parseInt(p.num, 10) || 0), 0);
                    
                    const { id: pendenteId, ...pendenteData } = pendente;

                    const completa = {
                        ...pendenteData,
                        num: (maxNum + 1).toString().padStart(6, '0'),
                        dataSaida: new Date(), 
                        peso2, peso2_eixo1, peso2_eixo2,
                        pesoBruto, tara, pesoLiquido: pesoBruto - tara
                    };
                    
                    const newDocRef = await addDoc(collection(this.state.db, 'pesagensCompletas'), completa);
                    await deleteDoc(doc(this.state.db, 'pesagensPendentes', id));

                    // Registrar log
                    await this.registrarLog('criou_saida', `Finalizou pesagem do veículo ${completa.placa} - Ticket #${completa.num}`, {
                        ticketId: newDocRef.id,
                        ticketNum: completa.num,
                        placa: completa.placa,
                        produto: completa.produto,
                        pesoLiquido: completa.pesoLiquido
                    });

                    const finalTicketData = { id: newDocRef.id, ...completa };
                    this.state.currentTicket = finalTicketData;
                    this.preencherTicket(finalTicketData);
                    this.dom.modalTicket.classList.add('active');
                    this.dom.formSaidaContainer.classList.add('hidden');
                } catch (error) {
                    console.error("Erro ao finalizar pesagem:", error);
                    this.showNotification("❌ " + (error.message || "Ocorreu um erro ao finalizar a pesagem."));
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Finalizar e Gerar Ticket';
                    }
                }
            },
            handleAcoesTicket(e) {
                if (!e.target.closest('button')) return;
                const button = e.target.closest('button');
                const id = button.dataset.id;
                const action = button.dataset.action;
                
                if (action === 'view') {
                    const pesagem = this.state.pesagensCompletas.find(p => p.id === id);
                    if (pesagem) { this.state.currentTicket = pesagem; this.preencherTicket(pesagem); this.dom.modalTicket.classList.add('active'); }
                } else if (action === 'edit') {
                    this.handleEditTicket(id);
                } else if (action === 'delete') {
                    this.state.ticketToDeleteId = id;
                    this.dom.modalConfirmDelete.classList.add('active');
                }
            },
            async handleConfirmDelete() {
                const id = this.state.ticketToDeleteId;
                if (!id) return;
                
                try {
                    // Buscar dados do ticket antes de deletar
                    const ticketData = this.state.pesagensCompletas.find(p => p.id === id);
                    
                    await deleteDoc(doc(this.state.db, 'pesagensCompletas', id));
                    
                    // Registrar log
                    if (ticketData) {
                        await this.registrarLog('deletou_ticket', `Deletou ticket #${ticketData.num} - Placa: ${ticketData.placa}`, {
                            ticketId: id,
                            ticketNum: ticketData.num,
                            placa: ticketData.placa,
                            produto: ticketData.produto,
                            pesoLiquido: ticketData.pesoLiquido
                        });
                    }
                    
                    this.showNotification("✅ Ticket apagado com sucesso!");
                } catch (error) {
                    console.error("Erro ao apagar o ticket:", error);
                    this.showNotification("❌ Ocorreu um erro ao apagar o ticket.");
                } finally {
                    this.state.ticketToDeleteId = null;
                    this.dom.modalConfirmDelete.classList.remove('active');
                }
            },
            formatarPeso: (peso) => (isNaN(peso) || peso === null ? 0 : Number(peso)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            formatarNotasFiscais(nf1, nf2) {
                const primaria = nf1 && nf1 !== '' ? nf1 : '*';
                const secundaria = typeof nf2 === 'string' ? nf2.trim() : '';
                return secundaria ? `${primaria} / ${secundaria}` : primaria;
            },
            preencherTicket(data) {
                const { config } = this.state;
                const logoHtml = config.logo ? `<img src="${config.logo}" alt="Logo" class="h-12 object-contain">` : '';
                
                let observacaoFinal = '';
                if (data.isPesagemDupla && data.peso1_eixo1 && data.peso2_eixo1) {
                    observacaoFinal += `Pesagem Dupla: P1(${this.formatarPeso(data.peso1_eixo1)}+${this.formatarPeso(data.peso1_eixo2)}) | P2(${this.formatarPeso(data.peso2_eixo1)}+${this.formatarPeso(data.peso2_eixo2)})`;
                }
                if (data.observacao) {
                    observacaoFinal += (observacaoFinal ? '\n' : '') + data.observacao;
                }

                const observacaoHtml = observacaoFinal ? `<div class="mt-3 pt-3 border-t border-gray-300"><h4 class="font-semibold text-gray-700 text-sm mb-2">Observações</h4><p class="text-sm text-gray-600 whitespace-pre-wrap">${observacaoFinal}</p></div>` : '';
                
                const notaFiscal2Html = data.notaFiscal2 ? `<div><p class="text-xs text-gray-500">2ª Nota Fiscal</p><p class="font-medium font-mono">${data.notaFiscal2}</p></div>` : '';

                let diferencaHtml = '';
                if (data.pesoNota && data.pesoNota > 0) {
                    const diferenca = data.pesoLiquido - data.pesoNota;
                    diferencaHtml = `<div class="grid grid-cols-2 gap-3 text-center border-t border-gray-300 pt-3 mt-3"><div class="p-2 bg-gray-50 rounded"><p class="text-xs text-gray-500 uppercase font-semibold mb-1">Peso da Nota</p><p class="font-mono font-bold text-base">${this.formatarPeso(data.pesoNota)}<span class="text-sm font-normal text-gray-500"> kg</span></p></div><div class="p-2 rounded" style="background: ${diferenca >= 0 ? '#dcfce7' : '#fee2e2'};"><p class="text-xs uppercase font-semibold mb-1" style="color: ${diferenca >= 0 ? '#16a34a' : '#dc2626'};">Diferença</p><p class="font-mono font-bold text-base" style="color: ${diferenca >= 0 ? '#16a34a' : '#dc2626'};">${diferenca >= 0 ? '+' : ''}${this.formatarPeso(diferenca)}<span class="text-sm font-normal"> kg</span></p></div></div>`;
                }

                this.dom.ticketContainer.innerHTML = `
                    <div class="font-sans text-gray-800 bg-white p-4" id="ticket-content">
                        <header class="flex justify-between items-start pb-3 border-b border-gray-300 mb-3">
                            <div class="flex items-center gap-3">
                                ${logoHtml}
                                <div>
                                    <h2 class="font-bold text-base text-gray-900">${config.nome}</h2>
                                    <p class="text-xs text-gray-500">${config.cnpj || ''}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-gray-500 uppercase">Ticket Nº</p>
                                <p class="font-mono font-bold text-lg text-gray-900">${data.num}</p>
                            </div>
                        </header>
                        
                        <main>
                            <!-- Informações Gerais -->
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">📅 Entrada</p>
                                    <p class="font-medium text-sm">${new Date(data.dataEntrada.seconds * 1000).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">📅 Saída</p>
                                    <p class="font-medium text-sm">${new Date(data.dataSaida.seconds * 1000).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">🚚 Placa</p>
                                    <p class="font-bold font-mono text-base">${data.placa}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">👤 Motorista</p>
                                    <p class="font-medium text-sm">${data.motorista}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">🏢 Cliente/Fornecedor</p>
                                    <p class="font-medium text-sm">${data.cliente}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">🚛 Transportadora</p>
                                    <p class="font-medium text-sm">${data.transportadora || 'N/A'}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">📄 Nota Fiscal</p>
                                    <p class="font-medium font-mono text-sm">${data.notaFiscal || '*'}</p>
                                </div>
                                ${notaFiscal2Html ? `<div class="p-2 bg-gray-50 rounded"><p class="text-xs text-gray-500 mb-1">📄 2ª Nota Fiscal</p><p class="font-medium font-mono text-sm">${data.notaFiscal2}</p></div>` : '<div></div>'}
                                <div class="col-span-2 p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">📦 Produto</p>
                                    <p class="font-medium text-sm">${data.produto} ${data.certificado ? `(Cert: ${data.certificado})` : ''}</p>
                                </div>
                                ${data.obra && data.obra !== 'N/A' ? `<div class="col-span-2 p-2 bg-gray-50 rounded"><p class="text-xs text-gray-500 mb-1">🏗️ Obra</p><p class="font-medium text-sm">${data.obra}</p></div>` : ''}
                            </div>
                            
                            <!-- Pesos -->
                            <div class="border-t border-gray-300 pt-3 mt-3">
                                <div class="grid grid-cols-3 gap-3 text-center">
                                    <div class="p-3 bg-blue-50 rounded-lg">
                                        <p class="text-xs text-blue-600 uppercase font-semibold mb-1">Peso Bruto</p>
                                        <p class="font-mono font-bold text-lg text-blue-900">${this.formatarPeso(data.pesoBruto)}</p>
                                        <p class="text-xs text-blue-600">kg</p>
                                    </div>
                                    <div class="p-3 bg-gray-50 rounded-lg">
                                        <p class="text-xs text-gray-600 uppercase font-semibold mb-1">Tara</p>
                                        <p class="font-mono font-bold text-lg text-gray-900">${this.formatarPeso(data.tara)}</p>
                                        <p class="text-xs text-gray-600">kg</p>
                                    </div>
                                    <div class="p-3 rounded-lg" style="background: linear-gradient(135deg, var(--color-accent-light) 0%, color-mix(in srgb, var(--color-accent) 20%, white) 100%);">
                                        <p class="text-xs uppercase font-bold mb-1" style="color: var(--color-accent);">⚖️ Peso Líquido</p>
                                        <p class="font-mono font-extrabold text-xl" style="color: var(--color-accent);">${this.formatarPeso(data.pesoLiquido)}</p>
                                        <p class="text-xs font-bold" style="color: var(--color-accent);">kg</p>
                                    </div>
                                </div>
                            </div>
                            
                            ${diferencaHtml}
                            ${observacaoHtml}
                        </main>
                        
                        <footer class="text-center text-xs text-gray-500 mt-4 pt-3 border-t border-gray-200">
                            <p>${config.footer || ''}</p>
                        </footer>
                    </div>
                `;
            },
            preencherTicketEntrada(data) {
                const { config } = this.state;
                const logoHtml = config.logo ? `<img src="${config.logo}" alt="Logo" class="h-12 object-contain">` : '';
                const observacaoHtml = data.observacao ? `<div class="mt-3 pt-3 border-t border-gray-300"><h4 class="font-semibold text-gray-700 text-sm mb-2">Observações</h4><p class="text-sm text-gray-600">${data.observacao}</p></div>` : '';
                const pesoNotaHtml = data.pesoNota ? `<div><p class="text-xs text-gray-500">Peso da Nota Fiscal</p><p class="font-medium font-mono">${this.formatarPeso(data.pesoNota)} kg</p></div>` : '';
                const notaFiscal2Html = data.notaFiscal2 ? `<div><p class="text-xs text-gray-500">2ª Nota Fiscal</p><p class="font-medium font-mono">${data.notaFiscal2}</p></div>` : '';
                const dataEntrada = data.dataEntrada.seconds ? new Date(data.dataEntrada.seconds * 1000) : data.dataEntrada;

                this.dom.ticketContainer.innerHTML = `
                    <div class="font-sans text-gray-800 bg-white p-4" id="ticket-content">
                        <header class="flex justify-between items-start pb-3 border-b border-gray-300 mb-3">
                            <div class="flex items-center gap-3">
                                ${logoHtml}
                                <div>
                                    <h2 class="font-bold text-base text-gray-900">${config.nome}</h2>
                                    <p class="text-xs text-gray-500">${config.cnpj || ''}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-base" style="color: var(--color-accent);">✓ ENTRADA</p>
                            </div>
                        </header>
                        
                        <main>
                            <!-- Informações Gerais -->
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">📅 Data de Entrada</p>
                                    <p class="font-medium text-sm">${dataEntrada.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">🚚 Placa</p>
                                    <p class="font-bold font-mono text-base">${data.placa}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">👤 Motorista</p>
                                    <p class="font-medium text-sm">${data.motorista}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">🏢 Cliente/Fornecedor</p>
                                    <p class="font-medium text-sm">${data.cliente}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">🚛 Transportadora</p>
                                    <p class="font-medium text-sm">${data.transportadora || 'N/A'}</p>
                                </div>
                                <div class="p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">📄 Nota Fiscal</p>
                                    <p class="font-medium font-mono text-sm">${data.notaFiscal || '*'}</p>
                                </div>
                                ${notaFiscal2Html ? `<div class="p-2 bg-gray-50 rounded"><p class="text-xs text-gray-500 mb-1">📄 2ª Nota Fiscal</p><p class="font-medium font-mono text-sm">${data.notaFiscal2}</p></div>` : ''}
                                ${pesoNotaHtml ? `<div class="p-2 bg-gray-50 rounded"><p class="text-xs text-gray-500 mb-1">⚖️ Peso da Nota Fiscal</p><p class="font-medium font-mono text-sm">${this.formatarPeso(data.pesoNota)} kg</p></div>` : ''}
                                <div class="col-span-2 p-2 bg-gray-50 rounded">
                                    <p class="text-xs text-gray-500 mb-1">📦 Produto</p>
                                    <p class="font-medium text-sm">${data.produto}</p>
                                </div>
                            </div>
                            
                            <!-- Peso da 1ª Pesagem -->
                            <div class="border-t border-gray-300 pt-3 mt-3">
                                <div class="text-center p-4 rounded-lg" style="background: linear-gradient(135deg, var(--color-accent-light) 0%, color-mix(in srgb, var(--color-accent) 20%, white) 100%);">
                                    <p class="text-sm uppercase font-bold mb-2" style="color: var(--color-accent);">⚖️ 1ª Pesagem</p>
                                    <p class="font-mono font-extrabold text-3xl" style="color: var(--color-accent);">${this.formatarPeso(data.peso1)}</p>
                                    <p class="text-base font-bold mt-1" style="color: var(--color-accent);">kg</p>
                                </div>
                            </div>
                            
                            ${observacaoHtml}
                        </main>
                        
                        <footer class="text-center text-xs text-gray-500 mt-6 pt-4 border-t border-gray-200">
                            <p>${config.footer || ''}</p>
                        </footer>
                    </div>
                `;
            },
            exportarTicketEntradaPDF() {
                if (!this.state.currentTicket) return;
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5' });
                const data = this.state.currentTicket;
                const config = this.state.config;
                const margin = 10;
                const pageWidth = doc.internal.pageSize.getWidth();
                let y = margin + 5;

                if (config.logo) { try { doc.addImage(config.logo, 'PNG', margin, y, 25, 12); } catch (e) { console.error("Error adding logo to PDF:", e); } }
                
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(16); doc.text(config.nome, margin + 28, y + 5);
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.text(config.cnpj, margin + 28, y + 10);

                doc.setFont('Helvetica', 'bold'); doc.setFontSize(12); doc.text('COMPROVANTE DE ENTRADA', pageWidth - margin, y + 7, { align: 'right' });
                y += 20;

                doc.setLineDashPattern([1, 1], 0); doc.line(margin, y, pageWidth - margin, y); y += 5;
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(9);

                const dataEntrada = data.dataEntrada.seconds ? new Date(data.dataEntrada.seconds * 1000) : data.dataEntrada;
                const addLine = (label, value) => { doc.setFont('Helvetica', 'bold'); doc.text(label, margin, y); doc.setFont('Helvetica', 'normal'); doc.text(String(value), margin + 35, y); y += 6; };
                
                addLine('Data Entrada:', dataEntrada.toLocaleString('pt-BR'));
                addLine('Placa:', data.placa);
                addLine('Motorista:', data.motorista);
                addLine('Cliente/Forn.:', data.cliente);
                addLine('Transportadora:', data.transportadora || 'N/A');
                addLine('Nota Fiscal:', data.notaFiscal || '*');
                if (data.notaFiscal2) addLine('2ª Nota Fiscal:', data.notaFiscal2);
                if(data.pesoNota) addLine('Peso da Nota:', `${this.formatarPeso(data.pesoNota)} kg`);
                addLine('Produto:', data.produto);
                y += 5;

                doc.setFontSize(10); doc.text('1ª Pesagem:', margin, y);
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(12); doc.text(`${this.formatarPeso(data.peso1)} kg`, margin + 35, y);
                y += 10;

                if (data.observacao) {
                    doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.text('Observações:', margin, y); y += 5;
                    doc.setFont('Helvetica', 'normal');
                    const splitText = doc.splitTextToSize(data.observacao, pageWidth - margin * 2);
                    doc.text(splitText, margin, y);
                }

                if (config.footer) {
                    doc.setFontSize(8); doc.setTextColor(150); doc.text(config.footer, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
                }
                doc.save(`comprovante_entrada_${data.placa}.pdf`);
            },
            exportarTicketPDF() {
                if (!this.state.currentTicket) { return; }
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5' });
                const data = this.state.currentTicket;
                const config = this.state.config;
                const margin = 10;
                const pageWidth = doc.internal.pageSize.getWidth();
                let y = margin + 5;

                if (config.logo) { try { doc.addImage(config.logo, 'PNG', margin, y, 25, 12); } catch (e) { console.error("Error adding logo to PDF:", e); } }
                
                doc.setFont('Helvetica', 'bold'); doc.setFontSize(16); doc.text(config.nome, margin + 28, y + 5); 
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(9); doc.text(config.cnpj, margin + 28, y + 10);

                doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.text('TICKET DE PESAGEM', pageWidth - margin, y, { align: 'right' });
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(14); doc.text(`${data.num}`, pageWidth - margin, y + 7, { align: 'right' }); 
                y += 20;

                doc.setLineDashPattern([1, 1], 0); doc.line(margin, y, pageWidth - margin, y); y += 5;
                doc.setFont('Helvetica', 'normal'); doc.setFontSize(9);

                const addLine = (label, value) => { doc.setFont('Helvetica', 'bold'); doc.text(label, margin, y); doc.setFont('Helvetica', 'normal'); doc.text(String(value), margin + 35, y); y += 6; };
                
                addLine('Entrada:', new Date(data.dataEntrada.seconds * 1000).toLocaleString('pt-BR'));
                addLine('Saída:', new Date(data.dataSaida.seconds * 1000).toLocaleString('pt-BR'));
                addLine('Nota Fiscal:', data.notaFiscal || '*');
                if (data.notaFiscal2) addLine('2ª Nota Fiscal:', data.notaFiscal2);
                addLine('Cliente/Forn.:', data.cliente);
                addLine('Transportadora:', data.transportadora || 'N/A');
                addLine('Obra:', data.obra || 'N/A');
                addLine('Produto:', data.produto);
                if (data.certificado) addLine('Certificado:', data.certificado);
                y += 2;
                doc.line(margin, y, pageWidth - margin, y); y += 5;
                addLine('Placa:', data.placa);
                addLine('Motorista:', data.motorista);
                y += 5;
                
                const col1 = margin; const col2 = pageWidth / 3 + margin / 2; const col3 = (pageWidth / 3) * 2;
                doc.setFontSize(8); doc.text('PESO BRUTO', col1, y); doc.text('TARA', col2, y); doc.text('PESO LÍQUIDO', col3, y); y += 5;
                doc.setFontSize(12); doc.setFont('Helvetica', 'bold');
                doc.text(`${this.formatarPeso(data.pesoBruto)} kg`, col1, y);
                doc.text(`${this.formatarPeso(data.tara)} kg`, col2, y);
                doc.setTextColor(13, 148, 136); doc.text(`${this.formatarPeso(data.pesoLiquido)} kg`, col3, y); doc.setTextColor(0, 0, 0);
                y += 10;

                let observacaoFinal = '';
                if (data.isPesagemDupla) { observacaoFinal += `Pesagem Dupla: P1(${this.formatarPeso(data.peso1_eixo1)}+${this.formatarPeso(data.peso1_eixo2)}) | P2(${this.formatarPeso(data.peso2_eixo1)}+${this.formatarPeso(data.peso2_eixo2)})`; }
                if (data.observacao) { observacaoFinal += (observacaoFinal ? '\n' : '') + data.observacao; }

                if (observacaoFinal) {
                    doc.setFont('Helvetica', 'bold'); doc.setFontSize(9);
                    doc.text('Observações:', margin, y); y += 5;
                    doc.setFont('Helvetica', 'normal');
                    const splitText = doc.splitTextToSize(observacaoFinal, pageWidth - margin * 2);
                    doc.text(splitText, margin, y);
                }

                if (config.footer) {
                    doc.setFontSize(8); doc.setFont('Helvetica', 'normal');
                    doc.text(config.footer, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
                }
                doc.save(`ticket-${data.num}.pdf`);
            },
            // Função auxiliar para converter HEX em RGB
            hexToRgb(hex) {
                if (!hex) return [13, 148, 136]; // Cor padrão teal
                hex = hex.replace('#', '');
                if (hex.length === 3) {
                    hex = hex.split('').map(c => c + c).join('');
                }
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                return [r, g, b];
            },

            exportarRelatorioPDF() {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

                const titulo = this.dom.relatorioTitulo.value.trim() || 'Relatório Geral de Pesagens';
                const pesagens = this.getFilteredPesagens();
                const metrics = this.computeRelatorioMetrics(pesagens);
                const config = this.state.config;
                const margin = 15;
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                let y = margin;

                // Obter cor da empresa (usar CSS variable ou fallback)
                const empresaCor = this.hexToRgb(config.corPrimaria || '#0d9488');

                // ===== CABEÇALHO PROFISSIONAL =====
                const logoWidth = 30, logoHeight = 15;
                if (config.logo) { 
                    try { 
                        doc.addImage(config.logo, 'PNG', margin, y, logoWidth, logoHeight); 
                    } catch (e) { 
                        console.warn('Erro ao adicionar logo:', e); 
                    } 
                }

                // Título e informações da empresa
                const textoX = config.logo ? margin + logoWidth + 8 : margin;
                doc.setFont('Helvetica', 'bold'); 
                doc.setFontSize(18);
                doc.setTextColor(...empresaCor);
                doc.text(titulo, textoX, y + 6);
                
                doc.setFont('Helvetica', 'normal'); 
                doc.setFontSize(11);
                doc.setTextColor(60, 60, 60);
                doc.text(config.nome || 'Empresa', textoX, y + 12);

                // Informações no canto direito
                doc.setFontSize(9);
                doc.setTextColor(80, 80, 80);
                const infoX = pageWidth - margin;
                let infoY = y + 3;
                
                const dataInicio = this.dom.filtroDataInicio.value;
                const dataFim = this.dom.filtroDataFim.value;
                let periodo = 'Todos os registros';
                if (dataInicio && dataFim) { 
                    periodo = `${new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR')} - ${new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR')}`; 
                }
                
                doc.text(`Período: ${periodo}`, infoX, infoY, { align: 'right' });
                infoY += 4;
                doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, infoX, infoY, { align: 'right' });
                infoY += 4;
                doc.text(`Total: ${pesagens.length} registro${pesagens.length !== 1 ? 's' : ''}`, infoX, infoY, { align: 'right' });

                y += Math.max(logoHeight, 15) + 6;

                // Linha separadora com cor da empresa
                doc.setDrawColor(...empresaCor);
                doc.setLineWidth(0.8);
                doc.line(margin, y, pageWidth - margin, y);
                y += 8;

                // ===== RESUMO EXECUTIVO =====
                const boxHeight = 32;
                const boxY = y;
                
                // Fundo com gradiente simulado (duas cores)
                doc.setFillColor(250, 251, 252);
                doc.rect(margin, boxY, pageWidth - 2 * margin, boxHeight, 'F');
                
                // Borda colorida
                doc.setDrawColor(...empresaCor);
                doc.setLineWidth(0.5);
                doc.rect(margin, boxY, pageWidth - 2 * margin, boxHeight);

                // Barra lateral de destaque
                doc.setFillColor(...empresaCor);
                doc.rect(margin, boxY, 4, boxHeight, 'F');

                y = boxY + 7;

                // Título do resumo
                doc.setFont('Helvetica', 'bold'); 
                doc.setFontSize(13);
                doc.setTextColor(...empresaCor);
                doc.text('📊 RESUMO EXECUTIVO', margin + 8, y);
                
                y += 9;

                // Cards de métricas
                doc.setFont('Helvetica', 'normal'); 
                doc.setFontSize(9);
                doc.setTextColor(90, 90, 90);
                
                const cardSpacing = (pageWidth - 2 * margin - 16) / 4;
                const card1X = margin + 8;
                const card2X = card1X + cardSpacing;
                const card3X = card2X + cardSpacing;
                const card4X = card3X + cardSpacing;

                // Card 1: Total de Pesagens
                doc.setFont('Helvetica', 'normal');
                doc.text('Total de Pesagens', card1X, y);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(14);
                doc.setTextColor(...empresaCor);
                doc.text(`${pesagens.length}`, card1X, y + 6);

                // Card 2: Peso Bruto Total
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(90, 90, 90);
                doc.text('Peso Bruto Total', card2X, y);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(70, 70, 70);
                doc.text(`${this.formatarPeso(metrics.totalBruto)} kg`, card2X, y + 6);

                // Card 3: Tara Total
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(90, 90, 90);
                doc.text('Tara Total', card3X, y);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(70, 70, 70);
                doc.text(`${this.formatarPeso(metrics.totalTara)} kg`, card3X, y + 6);

                // Card 4: Peso Líquido Total (Destaque)
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(...empresaCor);
                doc.text('PESO LÍQUIDO TOTAL', card4X, y);
                doc.setFontSize(16);
                doc.text(`${this.formatarPeso(metrics.totalLiquido)} kg`, card4X, y + 7);
                
                // Reset
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(10);

                y = boxY + boxHeight + 10;

                // ===== TABELA DE DADOS =====
                const head = [['Nº', 'Data', 'Placa', 'Motorista', 'NF', 'Cliente', 'Transportadora', 'Produto', 'Obra', 'P. Bruto', 'Tara', 'P. Líquido']];
                const body = pesagens.map(p => [
                    p.num,
                    new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR'),
                    p.placa,
                    p.motorista,
                    this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2),
                    p.cliente || 'N/A',
                    p.transportadora || 'N/A',
                    p.produto,
                    p.obra || 'N/A',
                    this.formatarPeso(p.pesoBruto),
                    this.formatarPeso(p.tara),
                    this.formatarPeso(p.pesoLiquido)
                ]);

                if (body.length === 0) {
                    doc.setFontSize(11);
                    doc.setTextColor(150, 150, 150);
                    doc.text("Nenhum registro encontrado para os filtros aplicados.", pageWidth / 2, y, { align: 'center' });
                } else {
                    doc.autoTable({
                        head: head,
                        body: body,
                        startY: y,
                        theme: 'grid',
                        headStyles: { 
                            fillColor: empresaCor,
                            textColor: [255, 255, 255],
                            fontStyle: 'bold',
                            fontSize: 9,
                            halign: 'center'
                        },
                        styles: { 
                            fontSize: 8,
                            cellPadding: 3,
                            lineColor: [220, 220, 220],
                            lineWidth: 0.1
                        },
                        columnStyles: { 
                            0: { halign: 'center', cellWidth: 12 },
                            1: { halign: 'center', cellWidth: 20 },
                            2: { halign: 'center', cellWidth: 18 },
                            9: { halign: 'right', cellWidth: 20 },
                            10: { halign: 'right', cellWidth: 18 },
                            11: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }
                        },
                        alternateRowStyles: {
                            fillColor: [248, 250, 252]
                        },
                        margin: { left: margin, right: margin },
                        didDrawPage: (data) => {
                            // Rodapé em todas as páginas
                            doc.setFontSize(8);
                            doc.setTextColor(120, 120, 120);
                            const footerY = pageHeight - 8;
                            
                            if (config.footer) {
                                doc.text(config.footer, pageWidth / 2, footerY, { align: 'center' });
                            }
                            
                            doc.text(
                                `Página ${data.pageNumber}`,
                                pageWidth - margin,
                                footerY,
                                { align: 'right' }
                            );
                        }
                    });
                }
                
                const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().getTime()}.pdf`;
                doc.save(nomeArquivo);
                
                this.showNotification('✅ PDF exportado com sucesso!');
                
                // Registrar log
                this.registrarLog('exportou_pdf', `Exportou relatório em PDF: ${titulo}`, {
                    nomeArquivo: nomeArquivo,
                    totalRegistros: pesagens.length,
                    pesoTotal: metrics.totalLiquido
                });
            },
            async handleImportarRelatorio(e) {
                const file = e.target.files[0];
                if (!file) return;

                this.dom.btnImportExcel.textContent = 'A importar...';
                this.dom.btnImportExcel.disabled = true;

                const reader = new FileReader();
                reader.onload = async (event) => {
                    let importedCount = 0, skippedCount = 0;
                    const erros = []; // Array para armazenar erros detalhados
                    
                    try {
                        const data = new Uint8Array(event.target.result);
                        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                        // VALIDAÇÃO 1: Verificar se a planilha tem dados
                        if (json.length === 0) { 
                            throw new Error("A planilha está vazia. Nenhum dado encontrado."); 
                        }

                        // VALIDAÇÃO 2: Verificar colunas obrigatórias
                        const colunasObrigatorias = ['Nº Ticket', 'Data Entrada', 'Data Saída', 'Placa', 'Peso Bruto (kg)', 'Tara (kg)', 'Peso Líquido (kg)'];
                        const primeiraLinha = json[0];
                        const colunasFaltantes = colunasObrigatorias.filter(col => !(col in primeiraLinha));
                        
                        if (colunasFaltantes.length > 0) {
                            throw new Error(`Colunas obrigatórias faltando: ${colunasFaltantes.join(', ')}`);
                        }

                        const parseDate = (value) => {
                            if (value instanceof Date && !isNaN(value)) return value;
                            if (typeof value === 'string') {
                                const parts = value.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);
                                if (parts) { return new Date(parts[3], parts[2] - 1, parts[1], parts[4], parts[5], parts[6]); }
                            }
                            return null;
                        };

                        // Função para validar formato de placa
                        const validarPlaca = (placa) => {
                            if (!placa || placa === 'N/A') return true; // Permite placas vazias
                            const placaLimpa = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
                            const padraoAntigo = /^[A-Z]{3}[0-9]{4}$/; // ABC1234
                            const padraoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/; // ABC1D23
                            return padraoAntigo.test(placaLimpa) || padraoMercosul.test(placaLimpa);
                        };

                        // Função para validar peso
                        const validarPeso = (peso, nomeCampo) => {
                            const pesoNum = parseFloat(peso);
                            if (isNaN(pesoNum)) {
                                return { valido: false, erro: `${nomeCampo} inválido: deve ser um número` };
                            }
                            if (pesoNum < 0) {
                                return { valido: false, erro: `${nomeCampo} inválido: não pode ser negativo` };
                            }
                            if (pesoNum > 100000) {
                                return { valido: false, erro: `${nomeCampo} inválido: excede limite de 100.000 kg` };
                            }
                            return { valido: true, valor: pesoNum };
                        };

                        const existingTicketNumbers = new Set(this.state.pesagensCompletas.map(p => p.num));
                        const completasRef = collection(this.state.db, 'pesagensCompletas');

                        for (let index = 0; index < json.length; index++) {
                            const row = json[index];
                            const linhaExcel = index + 2; // +2 porque linha 1 é cabeçalho

                            // VALIDAÇÃO 3: Ticket duplicado
                            const ticketNum = String(row['Nº Ticket'] || '').padStart(6, '0');
                            if (existingTicketNumbers.has(ticketNum)) { 
                                erros.push(`Linha ${linhaExcel}: Ticket ${ticketNum} já existe no sistema`);
                                skippedCount++; 
                                continue; 
                            }

                            // VALIDAÇÃO 4: Datas válidas
                            const dataEntrada = parseDate(row['Data Entrada']);
                            const dataSaida = parseDate(row['Data Saída']);

                            if (!dataEntrada || !dataSaida) { 
                                erros.push(`Linha ${linhaExcel}: Data de entrada ou saída inválida`);
                                skippedCount++; 
                                continue; 
                            }

                            // VALIDAÇÃO 5: Data de saída deve ser maior que entrada
                            if (dataSaida < dataEntrada) {
                                erros.push(`Linha ${linhaExcel}: Data de saída (${dataSaida.toLocaleDateString()}) é anterior à entrada (${dataEntrada.toLocaleDateString()})`);
                                skippedCount++;
                                continue;
                            }

                            // VALIDAÇÃO 6: Formato da placa
                            const placa = row['Placa'] || 'N/A';
                            if (!validarPlaca(placa)) {
                                erros.push(`Linha ${linhaExcel}: Placa "${placa}" com formato inválido (use ABC1234 ou ABC1D23)`);
                                skippedCount++;
                                continue;
                            }

                            // VALIDAÇÃO 7: Pesos válidos
                            const validacaoBruto = validarPeso(row['Peso Bruto (kg)'], 'Peso Bruto');
                            const validacaoTara = validarPeso(row['Tara (kg)'], 'Tara');
                            const validacaoLiquido = validarPeso(row['Peso Líquido (kg)'], 'Peso Líquido');

                            if (!validacaoBruto.valido) {
                                erros.push(`Linha ${linhaExcel}: ${validacaoBruto.erro}`);
                                skippedCount++;
                                continue;
                            }
                            if (!validacaoTara.valido) {
                                erros.push(`Linha ${linhaExcel}: ${validacaoTara.erro}`);
                                skippedCount++;
                                continue;
                            }
                            if (!validacaoLiquido.valido) {
                                erros.push(`Linha ${linhaExcel}: ${validacaoLiquido.erro}`);
                                skippedCount++;
                                continue;
                            }

                            // VALIDAÇÃO 8: Peso líquido deve ser coerente
                            const pesoBruto = validacaoBruto.valor;
                            const tara = validacaoTara.valor;
                            const pesoLiquido = validacaoLiquido.valor;
                            const pesoLiquidoCalculado = Math.abs(pesoBruto - tara);
                            const diferenca = Math.abs(pesoLiquido - pesoLiquidoCalculado);

                            if (diferenca > 10) { // Tolera diferença de até 10kg
                                erros.push(`Linha ${linhaExcel}: Peso líquido (${pesoLiquido} kg) inconsistente com Bruto-Tara (${pesoLiquidoCalculado.toFixed(2)} kg)`);
                                // Aviso, mas não bloqueia importação
                            }

                            // VALIDAÇÃO 9: Campos de texto não podem ser muito longos
                            const motorista = String(row['Motorista'] || 'N/A').substring(0, 100);
                            const produto = String(row['Produto'] || 'N/A').substring(0, 100);
                            const cliente = String(row['Cliente/Forn.'] || 'N/A').substring(0, 100);

                            // Se passou em todas as validações, cria o registro
                            const pesagem = {
                                num: ticketNum, 
                                notaFiscal: row['Nota Fiscal'] || '*', 
                                notaFiscal2: row['2ª Nota Fiscal'] ? String(row['2ª Nota Fiscal']) : null, 
                                dataEntrada, 
                                dataSaida,
                                placa: String(placa).toUpperCase().replace(/[^A-Z0-9]/g, ''), 
                                motorista: motorista,
                                cliente: cliente, 
                                transportadora: String(row['Transportadora'] || '').substring(0, 100), 
                                obra: String(row['Obra'] || 'N/A').substring(0, 100),
                                produto: produto, 
                                certificado: String(row['Certificado'] || '').substring(0, 50),
                                pesoBruto: pesoBruto, 
                                tara: tara,
                                pesoLiquido: pesoLiquido,
                                observacao: String(row['Observação'] || '').substring(0, 500), 
                                isPesagemDupla: false,
                                peso1: 0, peso2: 0, 
                                peso1_eixo1: null, peso1_eixo2: null, 
                                peso2_eixo1: null, peso2_eixo2: null,
                            };
                            
                            if (pesagem.pesoBruto > pesagem.tara) { 
                                pesagem.peso1 = pesagem.tara; 
                                pesagem.peso2 = pesagem.pesoBruto; 
                            } else { 
                                pesagem.peso1 = pesagem.pesoBruto; 
                                pesagem.peso2 = pesagem.tara; 
                            }

                            await addDoc(completasRef, pesagem);
                            existingTicketNumbers.add(ticketNum);
                            importedCount++;
                        }
                        
                        // Monta mensagem final detalhada
                        let message = `✅ ${importedCount} registos importados com sucesso!`;
                        if (skippedCount > 0) { 
                            message += `\n⚠️ ${skippedCount} registos ignorados devido a erros.`; 
                        }
                        
                        // Se houver erros, exibe no console e alerta o usuário
                        if (erros.length > 0) {
                            console.group('📋 Erros de Importação Detalhados');
                            erros.forEach(erro => console.warn(erro));
                            console.groupEnd();
                            
                            if (erros.length <= 5) {
                                message += '\n\nErros encontrados:\n' + erros.join('\n');
                            } else {
                                message += `\n\nTotal de ${erros.length} erros. Verifique o console (F12) para detalhes.`;
                            }
                        }
                        
                        // Registrar log
                        this.registrarLog('importou_dados', `Importou ${importedCount} registros de Excel`, {
                            nomeArquivo: file.name,
                            importados: importedCount,
                            ignorados: skippedCount,
                            totalErros: erros.length
                        });
                        
                        this.showNotification(message);

                    } catch (error) {
                        console.error("Erro ao importar:", error);
                        this.showNotification(`Erro: ${error.message}`);
                    } finally {
                        this.dom.btnImportExcel.textContent = 'Importar';
                        this.dom.btnImportExcel.disabled = false;
                        e.target.value = '';
                    }
                };
                reader.readAsArrayBuffer(file);
            },
            _gerarNomeRelatorio(extensao) {
                let nomeBase = 'relatorio';
                const produto = this.dom.filtroProduto.value;
                const dataInicio = this.dom.filtroDataInicio.value;
                const dataFim = this.dom.filtroDataFim.value;

                if (produto) {
                    nomeBase += `_${produto}`;
                }
                if (dataInicio) {
                    nomeBase += `_${dataInicio}`;
                }
                if (dataFim && dataFim !== dataInicio) {
                    nomeBase += `_a_${dataFim}`;
                }

                return `${nomeBase.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extensao}`;
            },

            exportarRelatorioPDF() {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                const pesagens = this.getFilteredPesagens();
                if (pesagens.length === 0) { this.showNotification("⚠️ Nenhum dado para exportar."); return; }

                // Calcular totais
                const totalViagens = pesagens.length;
                const totalPesoLiquido = pesagens.reduce((acc, p) => acc + (Number(p.pesoLiquido) || 0), 0);

                // Título
                doc.setFontSize(16);
                doc.text("Relatório Simples de Pesagens", 14, 15);

                // Totais no topo
                doc.setFontSize(10);
                doc.text(`Total de Viagens: ${totalViagens}`, 14, 25);
                doc.text(`Peso Líquido Total: ${this.formatarPeso(totalPesoLiquido)} kg`, 14, 30);

                const head = [['Nº', 'Data', 'Placa', 'Produto', 'Cliente', 'P. Líquido']];
                const body = pesagens.map(p => [
                    p.num,
                    new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR'),
                    p.placa,
                    p.produto,
                    p.cliente,
                    this.formatarPeso(p.pesoLiquido) + ' kg'
                ]);

                doc.autoTable({ 
                    head, 
                    body,
                    startY: 35,
                    theme: 'striped',
                    headStyles: { fillColor: [13, 148, 136] }
                });

                // Totais no rodapé
                const finalY = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text(`Total de Viagens: ${totalViagens}`, 14, finalY);
                doc.text(`Peso Líquido Total: ${this.formatarPeso(totalPesoLiquido)} kg`, 14, finalY + 5);

                doc.save(this._gerarNomeRelatorio('pdf'));
            },

            exportarRelatorioExcel() {
                const titulo = this.dom.relatorioTitulo.value.trim() || 'Relatório Geral de Pesagens';
                const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().getTime()}.xlsx`;
                const pesagens = this.getFilteredPesagens();
                const config = this.state.config;
                
                if (pesagens.length === 0) {
                    this.showNotification("⚠️ Nenhum dado para exportar.");
                    return;
                }
                
                // Calcular totais
                const totalPesoBruto = pesagens.reduce((acc, p) => acc + (Number(p.pesoBruto) || 0), 0);
                const totalTara = pesagens.reduce((acc, p) => acc + (Number(p.tara) || 0), 0);
                const totalPesoLiquido = pesagens.reduce((acc, p) => acc + (Number(p.pesoLiquido) || 0), 0);
                const totalPesoNota = pesagens.reduce((acc, p) => acc + (Number(p.pesoNota) || 0), 0);

                // ===== PREPARAR DADOS =====
                const dados = pesagens.map((p, index) => {
                    let obs = p.observacao || '';
                    if (p.isPesagemDupla) { 
                        obs += ` [P. Dupla: P1(${p.peso1_eixo1}+${p.peso1_eixo2}) P2(${p.peso2_eixo1}+${p.peso2_eixo2})]`; 
                    }
                    
                    // Calcular diferença e porcentagem
                    const pesoLiquido = Number(p.pesoLiquido) || 0;
                    const pesoNota = Number(p.pesoNota) || 0;
                    const diferenca = pesoNota > 0 ? (pesoLiquido - pesoNota) : '';
                    const percentual = pesoNota > 0 ? (((pesoLiquido - pesoNota) / pesoNota) * 100) : '';
                    
                    return {
                        num: index + 1,
                        ticket: p.num,
                        notaFiscal: this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2),
                        dataEntrada: new Date(p.dataEntrada.seconds * 1000),
                        dataSaida: new Date(p.dataSaida.seconds * 1000),
                        placa: p.placa,
                        motorista: p.motorista,
                        cliente: p.cliente,
                        transportadora: p.transportadora || 'N/A',
                        razaoSocial: p.razaoSocial || 'N/A',
                        obra: p.obra,
                        produto: p.produto,
                        certificado: p.certificado,
                        pesoBruto: p.pesoBruto,
                        tara: p.tara,
                        pesoLiquido: p.pesoLiquido,
                        pesoNota: pesoNota > 0 ? pesoNota : '',
                        diferenca: diferenca,
                        percentual: percentual,
                        observacao: obs.trim()
                    };
                });

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet([]);
                
                let currentRow = 0;
                
                // ===== CABEÇALHO PROFISSIONAL COM CORES =====
                // Linha 1: Título principal (mesclado) - AZUL ESCURO
                ws['A1'] = { t: 's', v: titulo, s: {
                    font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: 'FFFFFF' } },
                    alignment: { vertical: 'center', horizontal: 'center' },
                    fill: { patternType: 'solid', fgColor: { rgb: '1F4788' } },
                    border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                }};
                currentRow++;
                
                // Linha 2: Nome da empresa - CINZA CLARO
                ws['A2'] = { t: 's', v: config.nome || 'Empresa', s: {
                    font: { name: 'Calibri', sz: 14, bold: true },
                    alignment: { vertical: 'center', horizontal: 'center' },
                    fill: { patternType: 'solid', fgColor: { rgb: 'D9E1F2' } },
                    border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                }};
                currentRow++;
                
                // Linha 3: Período
                const dataInicio = this.dom.filtroDataInicio.value;
                const dataFim = this.dom.filtroDataFim.value;
                let periodo = 'Período: Todos os registros';
                if (dataInicio && dataFim) { 
                    periodo = `Período: ${new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR')}`; 
                }
                ws['A3'] = { t: 's', v: periodo, s: {
                    font: { name: 'Calibri', sz: 11 },
                    alignment: { vertical: 'center', horizontal: 'left' },
                    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } }
                }};
                currentRow++;
                
                // Linha 4: Data de geração
                ws['A4'] = { t: 's', v: `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, s: {
                    font: { name: 'Calibri', sz: 10, italic: true },
                    alignment: { vertical: 'center', horizontal: 'left' },
                    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } }
                }};
                currentRow++;
                
                currentRow++; // Linha em branco
                
                // ===== RESUMO EXECUTIVO COM DESTAQUE =====
                ws[`A${currentRow + 1}`] = { t: 's', v: '📊 RESUMO EXECUTIVO', s: {
                    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
                    alignment: { vertical: 'center', horizontal: 'center' },
                    fill: { patternType: 'solid', fgColor: { rgb: '0D9488' } },
                    border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } }
                }};
                currentRow++;
                
                // Linha de resumo 1
                const resumoRow1 = currentRow + 1;
                ws[`A${resumoRow1}`] = { t: 's', v: 'Total de Pesagens:', s: { font: { bold: true }, alignment: { horizontal: 'right' }, fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } } }};
                ws[`B${resumoRow1}`] = { t: 'n', v: pesagens.length, s: { font: { bold: true, color: { rgb: '0D9488' } }, alignment: { horizontal: 'center' }, fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } }, numFmt: '#,##0' }};
                ws[`D${resumoRow1}`] = { t: 's', v: 'Peso Bruto Total (kg):', s: { font: { bold: true }, alignment: { horizontal: 'right' }, fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } } }};
                ws[`E${resumoRow1}`] = { t: 'n', v: totalPesoBruto, s: { font: { bold: true, color: { rgb: '0D9488' } }, alignment: { horizontal: 'center' }, fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } }, numFmt: '#,##0' }};
                currentRow++;
                
                // Linha de resumo 2
                const resumoRow2 = currentRow + 1;
                ws[`A${resumoRow2}`] = { t: 's', v: 'Peso Líquido Total (kg):', s: { font: { bold: true }, alignment: { horizontal: 'right' }, fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } } }};
                ws[`B${resumoRow2}`] = { t: 'n', v: totalPesoLiquido, s: { font: { bold: true, color: { rgb: '0D9488' } }, alignment: { horizontal: 'center' }, fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } }, numFmt: '#,##0' }};
                ws[`D${resumoRow2}`] = { t: 's', v: 'Tara Total (kg):', s: { font: { bold: true }, alignment: { horizontal: 'right' }, fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } } }};
                ws[`E${resumoRow2}`] = { t: 'n', v: totalTara, s: { font: { bold: true, color: { rgb: '0D9488' } }, alignment: { horizontal: 'center' }, fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } }, numFmt: '#,##0' }};
                currentRow++;
                
                currentRow++; // Linha em branco
                
                // ===== TABELA DE DADOS COM FORMATAÇÃO PROFISSIONAL =====
                const dataStartRow = currentRow + 1;
                
                // CABEÇALHOS DA TABELA - VERDE TEAL COM BRANCO
                const headers = ['#', 'Nº Ticket', 'Nota Fiscal', 'Data Entrada', 'Data Saída', 'Placa', 'Motorista', 'Cliente/Forn.', 'Transportadora', 'Obra', 'Produto', 'Certificado', 'Peso Bruto (kg)', 'Tara (kg)', 'Peso Líquido (kg)', 'Peso Nota (kg)', '⚖️ Dif. (kg)', '📈 Dif. (%)', 'Observação'];
                
                headers.forEach((header, colIndex) => {
                    const cellAddr = XLSX.utils.encode_cell({ r: dataStartRow - 1, c: colIndex });
                    ws[cellAddr] = { t: 's', v: header, s: {
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                        fill: { patternType: 'solid', fgColor: { rgb: '0D9488' } },
                        border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
                    }};
                });
                
                // DADOS DA TABELA - ZEBRA STRIPING
                dados.forEach((row, rowIndex) => {
                    const excelRow = dataStartRow + rowIndex;
                    const isEven = rowIndex % 2 === 0;
                    const fillColor = isEven ? 'FFFFFF' : 'F2F2F2';
                    
                    // Verificar se é divergente
                    const isDivergente = row.diferenca && Math.abs(row.diferenca) > 50;
                    const divergenciaColor = isDivergente ? 'FFF2CC' : fillColor;
                    
                    const cellData = [
                        { v: row.num, t: 'n' },
                        { v: row.ticket, t: 's' },
                        { v: row.notaFiscal, t: 's' },
                        { v: row.dataEntrada, t: 'd' },
                        { v: row.dataSaida, t: 'd' },
                        { v: row.placa, t: 's' },
                        { v: row.motorista, t: 's' },
                        { v: row.cliente, t: 's' },
                        { v: row.transportadora, t: 's' },
                        { v: row.obra, t: 's' },
                        { v: row.produto, t: 's' },
                        { v: row.certificado, t: 's' },
                        { v: row.pesoBruto, t: 'n' },
                        { v: row.tara, t: 'n' },
                        { v: row.pesoLiquido, t: 'n' },
                        { v: row.pesoNota, t: row.pesoNota ? 'n' : 's' },
                        { v: row.diferenca, t: row.diferenca ? 'n' : 's' },
                        { v: row.percentual, t: row.percentual ? 'n' : 's' },
                        { v: row.observacao, t: 's' }
                    ];
                    
                    cellData.forEach((cell, colIndex) => {
                        const cellAddr = XLSX.utils.encode_cell({ r: excelRow, c: colIndex });
                        const cellStyle = {
                            font: { name: 'Calibri', sz: 10 },
                            alignment: { vertical: 'center', horizontal: colIndex <= 11 || colIndex >= 18 ? 'left' : 'center' },
                            fill: { patternType: 'solid', fgColor: { rgb: colIndex >= 16 && colIndex <= 17 ? divergenciaColor : fillColor } },
                            border: { top: { style: 'thin', color: { rgb: 'D9D9D9' } }, bottom: { style: 'thin', color: { rgb: 'D9D9D9' } }, left: { style: 'thin', color: { rgb: 'D9D9D9' } }, right: { style: 'thin', color: { rgb: 'D9D9D9' } } }
                        };
                        
                        // Formatos numéricos
                        if (cell.t === 'n' && colIndex >= 12 && colIndex <= 17) {
                            cellStyle.numFmt = '#,##0';
                            if (colIndex === 17 && cell.v !== '') cellStyle.numFmt = '0.00"%"'; // Percentual
                        }
                        
                        // Formato de data
                        if (cell.t === 'd') {
                            cellStyle.numFmt = 'dd/mm/yyyy hh:mm';
                        }
                        
                        // Destacar diferenças negativas em vermelho
                        if (colIndex === 16 && cell.v < 0) {
                            cellStyle.font.color = { rgb: 'FF0000' };
                            cellStyle.font.bold = true;
                        }
                        
                        ws[cellAddr] = { t: cell.t, v: cell.v, s: cellStyle };
                    });
                });
                
                // LINHA DE TOTAIS - DESTAQUE EM NEGRITO
                const totalRow = dataStartRow + dados.length;
                const diferencaTotal = totalPesoNota > 0 ? (totalPesoLiquido - totalPesoNota) : '';
                const percentualTotal = totalPesoNota > 0 ? (((totalPesoLiquido - totalPesoNota) / totalPesoNota) * 100) : '';
                
                const totaisData = [
                    { v: '', t: 's' },
                    { v: '⭐ TOTAIS', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: '', t: 's' },
                    { v: totalPesoBruto, t: 'n' },
                    { v: totalTara, t: 'n' },
                    { v: totalPesoLiquido, t: 'n' },
                    { v: totalPesoNota > 0 ? totalPesoNota : '', t: totalPesoNota > 0 ? 'n' : 's' },
                    { v: diferencaTotal, t: diferencaTotal ? 'n' : 's' },
                    { v: percentualTotal, t: percentualTotal ? 'n' : 's' },
                    { v: `${pesagens.length} viagens`, t: 's' }
                ];
                
                totaisData.forEach((cell, colIndex) => {
                    const cellAddr = XLSX.utils.encode_cell({ r: totalRow, c: colIndex });
                    const cellStyle = {
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        alignment: { vertical: 'center', horizontal: 'center' },
                        fill: { patternType: 'solid', fgColor: { rgb: '1F4788' } },
                        border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
                    };
                    
                    if (cell.t === 'n') {
                        cellStyle.numFmt = '#,##0';
                        if (colIndex === 17 && cell.v !== '') cellStyle.numFmt = '0.00"%"';
                    }
                    
                    ws[cellAddr] = { t: cell.t, v: cell.v, s: cellStyle };
                });
                
                // ===== CONFIGURAÇÕES FINAIS =====
                // Larguras das colunas otimizadas
                ws['!cols'] = [
                    { wch: 6 },   // #
                    { wch: 12 },  // Nº Ticket
                    { wch: 15 },  // Nota Fiscal
                    { wch: 18 },  // Data Entrada
                    { wch: 18 },  // Data Saída
                    { wch: 12 },  // Placa
                    { wch: 25 },  // Motorista
                    { wch: 28 },  // Cliente/Forn.
                    { wch: 30 },  // Transportadora
                    { wch: 22 },  // Obra
                    { wch: 28 },  // Produto
                    { wch: 16 },  // Certificado
                    { wch: 16 },  // Peso Bruto
                    { wch: 14 },  // Tara
                    { wch: 18 },  // Peso Líquido
                    { wch: 16 },  // Peso Nota
                    { wch: 14 },  // Dif. (kg)
                    { wch: 12 },  // Dif. (%)
                    { wch: 45 }   // Observação
                ];
                
                // Auto-filtro
                ws['!autofilter'] = { ref: `A${dataStartRow - 1}:S${totalRow}` };
                
                // Congelar painéis - congelar cabeçalho
                ws['!freeze'] = { xSplit: 0, ySplit: dataStartRow, topLeftCell: `A${dataStartRow + 1}`, state: 'frozen' };
                
                // Mesclar células do cabeçalho
                if (!ws['!merges']) ws['!merges'] = [];
                ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }); // Título
                ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }); // Nome empresa
                ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }); // Período
                ws['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }); // Data geração
                ws['!merges'].push({ s: { r: 5, c: 0 }, e: { r: 5, c: 8 } }); // Resumo Executivo
                
                // Definir range
                ws['!ref'] = `A1:S${totalRow}`;
                
                XLSX.utils.book_append_sheet(wb, ws, "Pesagens");
                XLSX.writeFile(wb, nomeArquivo);
                
                this.showNotification('✅ Excel PROFISSIONAL exportado com sucesso!');
                
                // Registrar log
                this.registrarLog('exportou_excel', `Exportou relatório Excel Profissional: ${titulo}`, {
                    nomeArquivo: nomeArquivo,
                    totalRegistros: pesagens.length,
                    pesoTotal: totalPesoLiquido
                });
            },
            exportarControleAgregado() {
                const nomeArquivo = this._gerarNomeRelatorio('xlsx').replace('relatorio', 'controle_agregado');
                const dados = this.getFilteredPesagens().map(p => ({
                    'Data Entrada': new Date(p.dataEntrada.seconds * 1000),
                    'Fornecedor': p.cliente, 'Transportadora': p.transportadora || 'N/A', 'Razão Social': p.razaoSocial || 'N/A', 'CNPJ': this.state.config.cnpj,
                    'Descrição Nota': p.produto, 'Ordem de Compra': '', 'Nº Ticket Interno': p.num,
                    'Nº Nota Fiscal': this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2), 'Data Fiscal': '', 'Quant. Declarada (NF)': (p.pesoLiquido || 0) / 1000,
                    'Quant. Recebida (NF)': (p.pesoLiquido || 0) / 1000, 'Valor Unitário (R$)': '', 'Valor Total (R$)': '',
                    'Centro de Custo': '', 'Status da Entrega': 'Entregue',
                }));

                if (dados.length === 0) { this.showNotification("⚠️ Nenhum dado para exportar."); return; }

                const ws = XLSX.utils.json_to_sheet(dados);
                
                const range = XLSX.utils.decode_range(ws['!ref']);
                for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                    for(let C of [0, 7]) { // Data Entrada, Data Fiscal
                        const cell_ref = XLSX.utils.encode_cell({c:C, r:R});
                        if (ws[cell_ref]) { ws[cell_ref].z = 'dd/mm/yyyy'; }
                    }
                    for(let C of [8, 9]) { // Quantidades
                        const cell_ref = XLSX.utils.encode_cell({c:C, r:R});
                        if (ws[cell_ref]) { ws[cell_ref].t = 'n'; ws[cell_ref].z = '#,##0.000'; }
                    }
                }

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Controle Agregado");
                XLSX.writeFile(wb, nomeArquivo);
            },

            // ===== NOVAS FUNÇÕES DE MELHORIAS DE RELATÓRIO =====
            toggleDropdown(tipo) {
                const dropdown = document.getElementById(`${tipo}-dropdown-menu`);
                const allDropdowns = document.querySelectorAll('.export-dropdown-content');
                
                allDropdowns.forEach(d => {
                    if (d !== dropdown) d.classList.remove('active');
                });
                
                dropdown?.classList.toggle('active');
            },

            aplicarFiltroRapido(periodo, btnElement) {
                const hoje = new Date();
                let dataInicio, dataFim;

                // Helper para formatar a data localmente e evitar problemas de timezone com toISOString()
                const toLocalISOString = (date) => {
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                switch(periodo) {
                    case 'hoje':
                        dataInicio = dataFim = toLocalISOString(hoje);
                        break;
                    case 'ontem':
                        const ontem = new Date(hoje);
                        ontem.setDate(ontem.getDate() - 1);
                        dataInicio = dataFim = toLocalISOString(ontem);
                        break;
                    case 'semana':
                        const semanaAtras = new Date(hoje);
                        semanaAtras.setDate(semanaAtras.getDate() - 7);
                        dataInicio = toLocalISOString(semanaAtras);
                        dataFim = toLocalISOString(hoje);
                        break;
                    case 'mes':
                        const mesAtras = new Date(hoje);
                        mesAtras.setMonth(mesAtras.getMonth() - 1);
                        dataInicio = toLocalISOString(mesAtras);
                        dataFim = toLocalISOString(hoje);
                        break;
                    case 'trimestre':
                        const trimestreAtras = new Date(hoje);
                        trimestreAtras.setMonth(trimestreAtras.getMonth() - 3);
                        dataInicio = toLocalISOString(trimestreAtras);
                        dataFim = toLocalISOString(hoje);
                        break;
                    case 'ano':
                        dataInicio = `${hoje.getFullYear()}-01-01`;
                        dataFim = toLocalISOString(hoje);
                        break;
                }

                this.dom.filtroDataInicio.value = dataInicio;
                this.dom.filtroDataFim.value = dataFim;
                
                // Atualizar botões ativos
                document.querySelectorAll('.filtro-rapido-btn').forEach(btn => btn.classList.remove('active'));
                btnElement.classList.add('active');
                
                this.state.ultimoPeriodoSelecionado = periodo;
                this.state.reportsCurrentPage = 1;
                this.renderRelatorios();
            },

            detectarDivergencias(pesagens) {
                const divergencias = pesagens.filter(p => {
                    if (!p.pesoNota || p.pesoNota === 0) return false;
                    const diferenca = Math.abs(p.pesoLiquido - p.pesoNota);
                    const percentual = (diferenca / p.pesoNota) * 100;
                    return percentual > 5; // Divergência > 5%
                });

                const divContainer = this.dom.relatorioDivergencias;
                const divLista = this.dom.relatorioDivergenciasLista;

                if (divergencias.length > 0) {
                    divLista.innerHTML = `
                        <p class="mb-2"><strong>${divergencias.length} ticket(s)</strong> com diferença superior a 5% entre peso da nota e peso líquido:</p>
                        <ul class="list-disc list-inside space-y-1">
                            ${divergencias.slice(0, 5).map(p => {
                                const diferenca = p.pesoLiquido - p.pesoNota;
                                const percentual = ((diferenca / p.pesoNota) * 100).toFixed(1);
                                return `<li>Ticket <strong>${p.num}</strong> - Placa ${p.placa}: ${diferenca >= 0 ? '+' : ''}${this.formatarPeso(diferenca)} kg (${percentual}%)</li>`;
                            }).join('')}
                            ${divergencias.length > 5 ? `<li class="text-xs italic">... e mais ${divergencias.length - 5} tickets</li>` : ''}
                        </ul>
                    `;
                    divContainer?.classList.remove('hidden');
                } else {
                    divContainer?.classList.add('hidden');
                }

                return divergencias;
            },

            exportarDivergencias() {
                const pesagens = this.getFilteredPesagens();
                const divergencias = pesagens.filter(p => {
                    if (!p.pesoNota || p.pesoNota === 0) return false;
                    const diferenca = Math.abs(p.pesoLiquido - p.pesoNota);
                    const percentual = (diferenca / p.pesoNota) * 100;
                    return percentual > 5;
                });

                if (divergencias.length === 0) {
                    this.showNotification("Nenhuma divergência encontrada! ✅");
                    return;
                }

                const dados = divergencias.map(p => ({
                    'Nº Ticket': p.num,
                    'Data': new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR'),
                    'Placa': p.placa,
                    'Nota Fiscal': this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2),
                    'Produto': p.produto,
                    'Peso da Nota (kg)': p.pesoNota,
                    'Peso Líquido (kg)': p.pesoLiquido,
                    '⚖️ Diferença (kg)': p.pesoLiquido - p.pesoNota,
                    '📈 Diferença (%)': (((p.pesoLiquido - p.pesoNota) / p.pesoNota) * 100).toFixed(2) + '%'
                }));

                const ws = XLSX.utils.json_to_sheet(dados);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Divergências");
                XLSX.writeFile(wb, `divergencias_${new Date().toISOString().slice(0,10)}.xlsx`);
                
                this.showNotification(`Exportadas ${divergencias.length} divergências! 📊`);
            },

            exportarRelatorioExcelMultiAbas() {
                const titulo = this.dom.relatorioTitulo.value.trim() || 'Relatório Completo';
                const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_completo_${new Date().getTime()}.xlsx`;
                const pesagens = this.getFilteredPesagens();
                const metrics = this.computeRelatorioMetrics(pesagens);
                const config = this.state.config;

                if (pesagens.length === 0) {
                    this.showNotification("⚠️ Nenhum dado para exportar.");
                    return;
                }

                const wb = XLSX.utils.book_new();

                // Função helper para criar cabeçalho padrão
                const criarCabecalho = (ws, tituloAba, currentRow = 0) => {
                    XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' });
                    currentRow++;
                    XLSX.utils.sheet_add_aoa(ws, [[config.nome || 'Empresa']], { origin: 'A2' });
                    currentRow++;
                    
                    const dataInicio = this.dom.filtroDataInicio.value;
                    const dataFim = this.dom.filtroDataFim.value;
                    let periodo = 'Período: Todos os registros';
                    if (dataInicio && dataFim) { 
                        periodo = `Período: ${new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR')}`; 
                    }
                    XLSX.utils.sheet_add_aoa(ws, [[periodo]], { origin: 'A3' });
                    currentRow++;
                    XLSX.utils.sheet_add_aoa(ws, [[`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`]], { origin: 'A4' });
                    currentRow++;
                    currentRow++; // Linha em branco
                    XLSX.utils.sheet_add_aoa(ws, [[tituloAba]], { origin: `A${currentRow + 1}` });
                    currentRow++;
                    return currentRow + 1; // Retorna a linha onde os dados começam
                };

                // ===== ABA 1: DADOS COMPLETOS =====
                const ws1 = XLSX.utils.aoa_to_sheet([]);
                const dataRow1 = criarCabecalho(ws1, 'DADOS COMPLETOS', 0);
                
                const dadosCompletos = pesagens.map(p => {
                    let obs = p.observacao || '';
                    if (p.isPesagemDupla) { 
                        obs += ` [P. Dupla: P1(${p.peso1_eixo1}+${p.peso1_eixo2}) P2(${p.peso2_eixo1}+${p.peso2_eixo2})]`; 
                    }
                    
                    // Calcular diferença e porcentagem
                    const pesoLiquido = Number(p.pesoLiquido) || 0;
                    const pesoNota = Number(p.pesoNota) || 0;
                    const diferenca = pesoNota > 0 ? (pesoLiquido - pesoNota) : '';
                    const percentual = pesoNota > 0 ? (((pesoLiquido - pesoNota) / pesoNota) * 100).toFixed(2) : '';
                    
                    return {
                        'Nº Ticket': p.num,
                        'Nota Fiscal': this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2),
                        'Data Entrada': new Date(p.dataEntrada.seconds * 1000),
                        'Data Saída': new Date(p.dataSaida.seconds * 1000),
                        'Placa': p.placa,
                        'Motorista': p.motorista,
                        'Cliente/Forn.': p.cliente,
                        'Transportadora': p.transportadora || 'N/A',
                        'Razão Social': p.razaoSocial || 'N/A',
                        'Obra': p.obra,
                        'Produto': p.produto,
                        'Certificado': p.certificado,
                        'Peso Bruto (kg)': p.pesoBruto,
                        'Tara (kg)': p.tara,
                        'Peso Líquido (kg)': p.pesoLiquido,
                        'Peso Nota (kg)': pesoNota > 0 ? pesoNota : '',
                        '⚖️ Diferença (kg)': diferenca,
                        '📈 Diferença (%)': percentual,
                        'Observação': obs.trim()
                    };
                });

                const totalBruto = pesagens.reduce((acc, p) => acc + (Number(p.pesoBruto) || 0), 0);
                const totalTara = pesagens.reduce((acc, p) => acc + (Number(p.tara) || 0), 0);
                const totalLiquido = pesagens.reduce((acc, p) => acc + (Number(p.pesoLiquido) || 0), 0);
                const totalPesoNota = pesagens.reduce((acc, p) => acc + (Number(p.pesoNota) || 0), 0);
                const diferencaTotal = totalPesoNota > 0 ? (totalLiquido - totalPesoNota) : '';
                const percentualTotal = totalPesoNota > 0 ? (((totalLiquido - totalPesoNota) / totalPesoNota) * 100).toFixed(2) : '';

                dadosCompletos.push({
                    'Nº Ticket': 'TOTAIS', 'Nota Fiscal': '', 'Data Entrada': '', 'Data Saída': '',
                    'Placa': '', 'Motorista': '', 'Cliente/Forn.': '', 'Transportadora': '', 'Obra': '', 'Produto': '',
                    'Certificado': '', 'Peso Bruto (kg)': totalBruto, 'Tara (kg)': totalTara, 'Peso Líquido (kg)': totalLiquido,
                    'Peso Nota (kg)': totalPesoNota > 0 ? totalPesoNota : '',
                    '⚖️ Diferença (kg)': diferencaTotal,
                    '📈 Diferença (%)': percentualTotal,
                    'Observação': `Total de Viagens: ${pesagens.length}`
                });

                const wsData1 = XLSX.utils.json_to_sheet(dadosCompletos, { origin: `A${dataRow1}` });
                Object.keys(wsData1).forEach(cell => { if (cell[0] !== '!') ws1[cell] = wsData1[cell]; });
                
                ws1['!cols'] = [
                    { wch: 19.80 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 28 }, { wch: 30 },
                    { wch: 35 }, { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, 
                    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 50 }
                ];
                ws1['!autofilter'] = { ref: `A${dataRow1}:R${dataRow1 + dadosCompletos.length - 1}` };
                ws1['!freeze'] = { xSplit: 0, ySplit: dataRow1, topLeftCell: `A${dataRow1 + 1}`, state: 'frozen' };
                if (!ws1['!merges']) ws1['!merges'] = [];
                ws1['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
                ws1['!ref'] = `A1:R${dataRow1 + dadosCompletos.length - 1}`;
                XLSX.utils.book_append_sheet(wb, ws1, "Dados Completos");

                // ===== ABA 2: RESUMO POR TRANSPORTADORA =====
                const ws2 = XLSX.utils.aoa_to_sheet([]);
                const dataRow2 = criarCabecalho(ws2, 'RESUMO POR TRANSPORTADORA', 0);
                
                XLSX.utils.sheet_add_aoa(ws2, [
                    ['📊 ESTATÍSTICAS GERAIS'],
                    ['Total de Viagens:', pesagens.length],
                    ['Peso Total (kg):', totalLiquido],
                    ['Peso Médio/Viagem:', Math.round(totalLiquido / pesagens.length)],
                    [], // Linha em branco
                    ['📋 DETALHAMENTO POR TRANSPORTADORA'],
                    [], // Linha em branco
                    ['#', 'Transportadora', 'Nº Viagens', 'Veículos', 'Peso Líquido (kg)', 'Peso Bruto (kg)', 'Tara (kg)', 'Peso Nota (kg)', '⚖️ Diferença (kg)', '📈 Diferença (%)', 'Média/Viagem (kg)', '% do Total']
                ], { origin: `A${dataRow2}` });
                
                // Calcular dados por transportadora diretamente
                const transportadorasCalc = pesagens.reduce((acc, p) => {
                    const transp = p.transportadora || 'Não Informado';
                    if (!acc[transp]) {
                        acc[transp] = { 
                            viagens: 0, 
                            pesoLiquido: 0, 
                            pesoBruto: 0, 
                            tara: 0,
                            pesoNota: 0,
                            placas: new Set()
                        };
                    }
                    acc[transp].viagens++;
                    acc[transp].pesoLiquido += Number(p.pesoLiquido) || 0;
                    acc[transp].pesoBruto += Number(p.pesoBruto) || 0;
                    acc[transp].tara += Number(p.tara) || 0;
                    acc[transp].pesoNota += Number(p.pesoNota) || 0;
                    acc[transp].placas.add(p.placa);
                    return acc;
                }, {});
                
                const transportadorasData = Object.entries(transportadorasCalc)
                    .sort(([, a], [, b]) => b.pesoLiquido - a.pesoLiquido)
                    .map(([nome, valores], index) => {
                        const diff = valores.pesoNota > 0 ? valores.pesoLiquido - valores.pesoNota : '';
                        const perc = valores.pesoNota > 0 ? (((valores.pesoLiquido - valores.pesoNota) / valores.pesoNota) * 100).toFixed(1) : '';
                        
                        return [
                            index + 1,
                            nome,
                            valores.viagens,
                            valores.placas.size,
                            Math.round(valores.pesoLiquido),
                            Math.round(valores.pesoBruto),
                            Math.round(valores.tara),
                            valores.pesoNota > 0 ? Math.round(valores.pesoNota) : '-',
                            diff !== '' ? diff.toFixed(0) : '-',
                            perc !== '' ? perc + '%' : '-',
                            Math.round(valores.pesoLiquido / valores.viagens),
                            ((valores.pesoLiquido / totalLiquido) * 100).toFixed(1) + '%'
                        ];
                    });
                
                // Adicionar linha de totais
                const totalTranspViagens = transportadorasData.reduce((acc, t) => acc + t[2], 0);
                const totalTranspPesoLiq = transportadorasData.reduce((acc, t) => acc + (typeof t[4] === 'number' ? t[4] : 0), 0);
                const totalTranspPesoBruto = transportadorasData.reduce((acc, t) => acc + (typeof t[5] === 'number' ? t[5] : 0), 0);
                const totalTranspTara = transportadorasData.reduce((acc, t) => acc + (typeof t[6] === 'number' ? t[6] : 0), 0);
                
                transportadorasData.push([
                    '',
                    '⭐ TOTAIS',
                    totalTranspViagens,
                    '',
                    totalTranspPesoLiq,
                    totalTranspPesoBruto,
                    totalTranspTara,
                    '-',
                    '-',
                    '-',
                    Math.round(totalTranspPesoLiq / totalTranspViagens),
                    '100%'
                ]);
                
                XLSX.utils.sheet_add_aoa(ws2, transportadorasData, { origin: `A${dataRow2 + 8}` });
                
                ws2['!cols'] = [
                    { wch: 5 }, { wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, 
                    { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, 
                    { wch: 20 }, { wch: 14 }
                ];
                ws2['!autofilter'] = { ref: `A${dataRow2 + 7}:L${dataRow2 + 7 + transportadorasData.length - 1}` };
                ws2['!freeze'] = { xSplit: 0, ySplit: dataRow2 + 7, topLeftCell: `A${dataRow2 + 8}`, state: 'frozen' };
                if (!ws2['!merges']) ws2['!merges'] = [];
                ws2['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
                ws2['!merges'].push({ s: { r: dataRow2, c: 0 }, e: { r: dataRow2, c: 5 } }); // Estatísticas
                ws2['!merges'].push({ s: { r: dataRow2 + 5, c: 0 }, e: { r: dataRow2 + 5, c: 5 } }); // Detalhamento
                ws2['!ref'] = `A1:L${dataRow2 + 8 + transportadorasData.length - 1}`;
                XLSX.utils.book_append_sheet(wb, ws2, "Por Transportadora");

                // ===== ABA 3: RESUMO POR PRODUTO =====
                const ws3 = XLSX.utils.aoa_to_sheet([]);
                const dataRow3 = criarCabecalho(ws3, 'RESUMO POR PRODUTO', 0);
                
                XLSX.utils.sheet_add_aoa(ws3, [
                    ['📊 ESTATÍSTICAS GERAIS'],
                    ['Total de Carregamentos:', pesagens.length],
                    ['Peso Total (kg):', totalLiquido],
                    ['Peso Médio/Carregamento:', Math.round(totalLiquido / pesagens.length)],
                    [], // Linha em branco
                    ['📋 DETALHAMENTO POR PRODUTO'],
                    [], // Linha em branco
                    ['#', 'Produto', 'Nº Viagens', 'Transportadoras', 'Motoristas', 'Peso Líquido (kg)', 'Peso Bruto (kg)', 'Tara (kg)', 'Peso Nota (kg)', '⚖️ Diferença (kg)', '📈 Diferença (%)', 'Média/Viagem (kg)', '% do Total']
                ], { origin: `A${dataRow3}` });
                
                const produtosData = pesagens.reduce((acc, p) => {
                    const prod = p.produto || 'Não Informado';
                    if (!acc[prod]) {
                        acc[prod] = { 
                            viagens: 0, 
                            pesoLiquido: 0, 
                            pesoBruto: 0,
                            tara: 0,
                            pesoNota: 0,
                            transportadoras: new Set(),
                            motoristas: new Set()
                        };
                    }
                    acc[prod].viagens++;
                    acc[prod].pesoLiquido += Number(p.pesoLiquido) || 0;
                    acc[prod].pesoBruto += Number(p.pesoBruto) || 0;
                    acc[prod].tara += Number(p.tara) || 0;
                    acc[prod].pesoNota += Number(p.pesoNota) || 0;
                    acc[prod].transportadoras.add(p.transportadora);
                    acc[prod].motoristas.add(p.motorista);
                    return acc;
                }, {});
                
                const produtosSheet = Object.entries(produtosData)
                    .sort(([, a], [, b]) => b.pesoLiquido - a.pesoLiquido)
                    .map(([nome, dados], index) => {
                        const diff = dados.pesoNota > 0 ? dados.pesoLiquido - dados.pesoNota : '';
                        const perc = dados.pesoNota > 0 ? (((dados.pesoLiquido - dados.pesoNota) / dados.pesoNota) * 100).toFixed(1) : '';
                        
                        return [
                            index + 1,
                            nome,
                            dados.viagens,
                            dados.transportadoras.size,
                            dados.motoristas.size,
                            Math.round(dados.pesoLiquido),
                            Math.round(dados.pesoBruto),
                            Math.round(dados.tara),
                            dados.pesoNota > 0 ? Math.round(dados.pesoNota) : '-',
                            diff !== '' ? diff.toFixed(0) : '-',
                            perc !== '' ? perc + '%' : '-',
                            Math.round(dados.pesoLiquido / dados.viagens),
                            ((dados.pesoLiquido / totalLiquido) * 100).toFixed(1) + '%'
                        ];
                    });
                
                // Adicionar linha de totais
                const totalProdViagens = produtosSheet.reduce((acc, p) => acc + p[2], 0);
                const totalProdPesoLiq = produtosSheet.reduce((acc, p) => acc + (typeof p[5] === 'number' ? p[5] : 0), 0);
                const totalProdPesoBruto = produtosSheet.reduce((acc, p) => acc + (typeof p[6] === 'number' ? p[6] : 0), 0);
                const totalProdTara = produtosSheet.reduce((acc, p) => acc + (typeof p[7] === 'number' ? p[7] : 0), 0);
                
                produtosSheet.push([
                    '',
                    '⭐ TOTAIS',
                    totalProdViagens,
                    '',
                    '',
                    totalProdPesoLiq,
                    totalProdPesoBruto,
                    totalProdTara,
                    '-',
                    '-',
                    '-',
                    Math.round(totalProdPesoLiq / totalProdViagens),
                    '100%'
                ]);
                
                XLSX.utils.sheet_add_aoa(ws3, produtosSheet, { origin: `A${dataRow3 + 8}` });
                
                ws3['!cols'] = [
                    { wch: 5 }, { wch: 35 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
                    { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
                    { wch: 18 }, { wch: 20 }, { wch: 14 }
                ];
                ws3['!autofilter'] = { ref: `A${dataRow3 + 7}:M${dataRow3 + 7 + produtosSheet.length - 1}` };
                ws3['!freeze'] = { xSplit: 0, ySplit: dataRow3 + 7, topLeftCell: `A${dataRow3 + 8}`, state: 'frozen' };
                if (!ws3['!merges']) ws3['!merges'] = [];
                ws3['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
                ws3['!merges'].push({ s: { r: dataRow3, c: 0 }, e: { r: dataRow3, c: 5 } }); // Estatísticas
                ws3['!merges'].push({ s: { r: dataRow3 + 5, c: 0 }, e: { r: dataRow3 + 5, c: 5 } }); // Detalhamento
                ws3['!ref'] = `A1:M${dataRow3 + 8 + produtosSheet.length - 1}`;
                XLSX.utils.book_append_sheet(wb, ws3, "Por Produto");

                // ===== ABA 4: RESUMO DIÁRIO =====
                const ws4 = XLSX.utils.aoa_to_sheet([]);
                const dataRow4 = criarCabecalho(ws4, 'RESUMO DIÁRIO', 0);
                
                XLSX.utils.sheet_add_aoa(ws4, [
                    ['📊 ESTATÍSTICAS GERAIS'],
                    ['Total de Viagens:', pesagens.length],
                    ['Peso Total (kg):', totalLiquido],
                    ['Período:', `${pesagens.length} registros`],
                    [], // Linha em branco
                    ['📋 TIMELINE DIÁRIA'],
                    [], // Linha em branco
                    ['Data', 'Dia da Semana', 'Nº Viagens', 'Transportadoras', 'Motoristas', 'Produtos', 'Peso Líquido (kg)', 'Peso Bruto (kg)', 'Tara (kg)', 'Peso Nota (kg)', '⚖️ Diferença (kg)', '📈 Diferença (%)', 'Média/Viagem (kg)', '% do Total']
                ], { origin: `A${dataRow4}` });
                
                const diarioData = pesagens.reduce((acc, p) => {
                    const data = new Date(p.dataEntrada.seconds * 1000).toISOString().split('T')[0];
                    if (!acc[data]) {
                        acc[data] = { 
                            viagens: 0, 
                            pesoLiquido: 0, 
                            pesoBruto: 0,
                            tara: 0,
                            pesoNota: 0,
                            transportadoras: new Set(),
                            motoristas: new Set(),
                            produtos: new Set()
                        };
                    }
                    acc[data].viagens++;
                    acc[data].pesoLiquido += Number(p.pesoLiquido) || 0;
                    acc[data].pesoBruto += Number(p.pesoBruto) || 0;
                    acc[data].tara += Number(p.tara) || 0;
                    acc[data].pesoNota += Number(p.pesoNota) || 0;
                    acc[data].transportadoras.add(p.transportadora);
                    acc[data].motoristas.add(p.motorista);
                    acc[data].produtos.add(p.produto);
                    return acc;
                }, {});
                
                const diarioSheet = Object.entries(diarioData)
                    .sort(([a], [b]) => new Date(a) - new Date(b))
                    .map(([data, dados]) => {
                        const diff = dados.pesoNota > 0 ? dados.pesoLiquido - dados.pesoNota : '';
                        const perc = dados.pesoNota > 0 ? (((dados.pesoLiquido - dados.pesoNota) / dados.pesoNota) * 100).toFixed(1) : '';
                        
                        return [
                            new Date(data + 'T00:00:00'),
                            ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(data).getDay()],
                            dados.viagens,
                            dados.transportadoras.size,
                            dados.motoristas.size,
                            dados.produtos.size,
                            Math.round(dados.pesoLiquido),
                            Math.round(dados.pesoBruto),
                            Math.round(dados.tara),
                            dados.pesoNota > 0 ? Math.round(dados.pesoNota) : '-',
                            diff !== '' ? diff.toFixed(0) : '-',
                            perc !== '' ? perc + '%' : '-',
                            Math.round(dados.pesoLiquido / dados.viagens),
                            ((dados.pesoLiquido / totalLiquido) * 100).toFixed(1) + '%'
                        ];
                    });
                
                // Adicionar linha de totais
                const totalDiarioViagens = diarioSheet.reduce((acc, d) => acc + d[2], 0);
                const totalDiarioPesoLiq = diarioSheet.reduce((acc, d) => acc + (typeof d[6] === 'number' ? d[6] : 0), 0);
                const totalDiarioPesoBruto = diarioSheet.reduce((acc, d) => acc + (typeof d[7] === 'number' ? d[7] : 0), 0);
                const totalDiarioTara = diarioSheet.reduce((acc, d) => acc + (typeof d[8] === 'number' ? d[8] : 0), 0);
                
                diarioSheet.push([
                    '⭐ TOTAIS',
                    '',
                    totalDiarioViagens,
                    '',
                    '',
                    '',
                    totalDiarioPesoLiq,
                    totalDiarioPesoBruto,
                    totalDiarioTara,
                    '-',
                    '-',
                    '-',
                    Math.round(totalDiarioPesoLiq / totalDiarioViagens),
                    '100%'
                ]);
                
                XLSX.utils.sheet_add_aoa(ws4, diarioSheet, { origin: `A${dataRow4 + 8}` });
                
                ws4['!cols'] = [
                    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
                    { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
                    { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }
                ];
                ws4['!autofilter'] = { ref: `A${dataRow4 + 7}:N${dataRow4 + 7 + diarioSheet.length - 1}` };
                ws4['!freeze'] = { xSplit: 0, ySplit: dataRow4 + 7, topLeftCell: `A${dataRow4 + 8}`, state: 'frozen' };
                if (!ws4['!merges']) ws4['!merges'] = [];
                ws4['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
                ws4['!merges'].push({ s: { r: dataRow4, c: 0 }, e: { r: dataRow4, c: 5 } }); // Estatísticas
                ws4['!merges'].push({ s: { r: dataRow4 + 5, c: 0 }, e: { r: dataRow4 + 5, c: 5 } }); // Timeline
                ws4['!ref'] = `A1:N${dataRow4 + 8 + diarioSheet.length - 1}`;
                XLSX.utils.book_append_sheet(wb, ws4, "Resumo Diário");

                // ===== ABA 5: TOP 10 MOTORISTAS =====
                const ws5 = XLSX.utils.aoa_to_sheet([]);
                const dataRow5 = criarCabecalho(ws5, 'TOP 10 MOTORISTAS - MAIS VIAGENS', 0);
                
                const motoristasData = pesagens.reduce((acc, p) => {
                    const motorista = p.motorista || 'Não Informado';
                    if (!acc[motorista]) acc[motorista] = { viagens: 0, peso: 0, placas: new Set() };
                    acc[motorista].viagens++;
                    acc[motorista].peso += p.pesoLiquido || 0;
                    acc[motorista].placas.add(p.placa);
                    return acc;
                }, {});
                
                const top10Motoristas = Object.entries(motoristasData)
                    .sort(([, a], [, b]) => b.viagens - a.viagens)
                    .slice(0, 10)
                    .map(([nome, dados], index) => ({
                        '🏆 Posição': index + 1,
                        'Motorista': nome,
                        'Nº Viagens': dados.viagens,
                        'Peso Total (kg)': dados.peso,
                        'Média/Viagem (kg)': Math.round(dados.peso / dados.viagens),
                        'Veículos Diferentes': dados.placas.size
                    }));
                
                const wsData5 = XLSX.utils.json_to_sheet(top10Motoristas, { origin: `A${dataRow5}` });
                Object.keys(wsData5).forEach(cell => { if (cell[0] !== '!') ws5[cell] = wsData5[cell]; });
                
                ws5['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];
                ws5['!autofilter'] = { ref: `A${dataRow5}:F${dataRow5 + top10Motoristas.length - 1}` };
                ws5['!freeze'] = { xSplit: 0, ySplit: dataRow5, topLeftCell: `A${dataRow5 + 1}`, state: 'frozen' };
                if (!ws5['!merges']) ws5['!merges'] = [];
                ws5['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
                ws5['!ref'] = `A1:F${dataRow5 + top10Motoristas.length - 1}`;
                XLSX.utils.book_append_sheet(wb, ws5, "Top Motoristas");

                // ===== ABA 6: ANÁLISE DE DIVERGÊNCIAS =====
                const ws6 = XLSX.utils.aoa_to_sheet([]);
                const dataRow6 = criarCabecalho(ws6, 'ANÁLISE DE DIVERGÊNCIAS (Peso Nota vs Balança)', 0);
                
                const pesagensComNota = pesagens.filter(p => Number(p.pesoNota) > 0);
                const divergencias = pesagensComNota.filter(p => {
                    const diff = Math.abs(Number(p.pesoLiquido) - Number(p.pesoNota));
                    return diff > 50; // Divergência > 50kg
                });
                
                XLSX.utils.sheet_add_aoa(ws6, [
                    ['📊 ESTATÍSTICAS GERAIS'],
                    ['Total de Pesagens:', pesagens.length],
                    ['Pesagens com Nota Fiscal:', pesagensComNota.length],
                    ['Divergências Encontradas (>50kg):', divergencias.length],
                    ['Taxa de Divergência:', pesagensComNota.length > 0 ? ((divergencias.length / pesagensComNota.length) * 100).toFixed(1) + '%' : '0%'],
                    [], // Linha em branco
                    ['⚠️ LISTA DE DIVERGÊNCIAS']
                ], { origin: `A${dataRow6}` });
                
                const divergenciasData = divergencias
                    .sort((a, b) => Math.abs(Number(b.pesoLiquido) - Number(b.pesoNota)) - Math.abs(Number(a.pesoLiquido) - Number(a.pesoNota)))
                    .map(p => {
                        const pesoLiq = Number(p.pesoLiquido) || 0;
                        const pesoNF = Number(p.pesoNota) || 0;
                        const diff = pesoLiq - pesoNF;
                        const perc = pesoNF > 0 ? ((diff / pesoNF) * 100).toFixed(2) : '0';
                        const status = diff > 0 ? '📈 Excesso' : '📉 Falta';
                        
                        return {
                            'Status': status,
                            'Nº Ticket': p.num,
                            'Data': new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR'),
                            'Placa': p.placa,
                            'Produto': p.produto,
                            'Nota Fiscal': this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2),
                            'Peso Balança (kg)': pesoLiq,
                            'Peso Nota (kg)': pesoNF,
                            '⚖️ Diferença (kg)': Math.abs(diff).toFixed(2),
                            '📈 Diferença (%)': perc + '%'
                        };
                    });
                
                if (divergenciasData.length > 0) {
                    const wsData6 = XLSX.utils.json_to_sheet(divergenciasData, { origin: `A${dataRow6 + 7}` });
                    Object.keys(wsData6).forEach(cell => { if (cell[0] !== '!') ws6[cell] = wsData6[cell]; });
                    
                    ws6['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
                    ws6['!autofilter'] = { ref: `A${dataRow6 + 7}:J${dataRow6 + 7 + divergenciasData.length - 1}` };
                    ws6['!freeze'] = { xSplit: 0, ySplit: dataRow6 + 7, topLeftCell: `A${dataRow6 + 8}`, state: 'frozen' };
                    ws6['!ref'] = `A1:J${dataRow6 + 7 + divergenciasData.length - 1}`;
                } else {
                    XLSX.utils.sheet_add_aoa(ws6, [['✅ Nenhuma divergência significativa encontrada!']], { origin: `A${dataRow6 + 7}` });
                    ws6['!ref'] = `A1:J${dataRow6 + 8}`;
                }
                
                if (!ws6['!merges']) ws6['!merges'] = [];
                ws6['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
                ws6['!merges'].push({ s: { r: dataRow6, c: 0 }, e: { r: dataRow6, c: 5 } }); // Título Estatísticas
                ws6['!merges'].push({ s: { r: dataRow6 + 6, c: 0 }, e: { r: dataRow6 + 6, c: 5 } }); // Título Lista
                XLSX.utils.book_append_sheet(wb, ws6, "Divergências");

                // ===== ABA 7: RESUMO EXECUTIVO =====
                const ws7 = XLSX.utils.aoa_to_sheet([]);
                const dataRow7 = criarCabecalho(ws7, '📊 DASHBOARD EXECUTIVO', 0);
                
                const maiorPeso = Math.max(...pesagens.map(p => p.pesoLiquido || 0));
                const menorPeso = Math.min(...pesagens.filter(p => p.pesoLiquido > 0).map(p => p.pesoLiquido));
                const mediaPeso = totalLiquido / pesagens.length;
                
                const diasUnicos = new Set(pesagens.map(p => new Date(p.dataEntrada.seconds * 1000).toISOString().split('T')[0])).size;
                const mediaViagensDia = pesagens.length / diasUnicos;
                
                const transportadoraMaisAtiva = Object.entries(metrics.transportadoras)
                    .sort(([, a], [, b]) => b.viagens - a.viagens)[0];
                
                const produtoMaisMovimentado = Object.entries(produtosData)
                    .sort(([, a], [, b]) => b.peso - a.peso)[0];
                
                XLSX.utils.sheet_add_aoa(ws7, [
                    ['📈 INDICADORES PRINCIPAIS'],
                    ['Total de Viagens:', pesagens.length],
                    ['Peso Total Transportado:', `${totalLiquido.toLocaleString('pt-BR')} kg (${(totalLiquido / 1000).toFixed(2)} ton)`],
                    ['Peso Médio por Viagem:', `${Math.round(mediaPeso).toLocaleString('pt-BR')} kg`],
                    ['Maior Peso Registrado:', `${maiorPeso.toLocaleString('pt-BR')} kg`],
                    ['Menor Peso Registrado:', `${menorPeso.toLocaleString('pt-BR')} kg`],
                    [],
                    ['📅 ANÁLISE TEMPORAL'],
                    ['Período Analisado:', `${diasUnicos} dias`],
                    ['Média de Viagens/Dia:', Math.round(mediaViagensDia)],
                    ['Primeira Pesagem:', new Date(Math.min(...pesagens.map(p => p.dataEntrada.seconds * 1000))).toLocaleDateString('pt-BR')],
                    ['Última Pesagem:', new Date(Math.max(...pesagens.map(p => p.dataEntrada.seconds * 1000))).toLocaleDateString('pt-BR')],
                    [],
                    ['🏆 DESTAQUES'],
                    ['Transportadora Mais Ativa:', transportadoraMaisAtiva ? `${transportadoraMaisAtiva[0]} (${transportadoraMaisAtiva[1].viagens} viagens)` : 'N/A'],
                    ['Produto Mais Movimentado:', produtoMaisMovimentado ? `${produtoMaisMovimentado[0]} (${(produtoMaisMovimentado[1].peso / 1000).toFixed(1)} ton)` : 'N/A'],
                    ['Total de Motoristas:', Object.keys(motoristasData).length],
                    ['Total de Placas Diferentes:', new Set(pesagens.map(p => p.placa)).size],
                    [],
                    ['💰 ANÁLISE DE DIVERGÊNCIAS'],
                    ['Pesagens com Nota Fiscal:', pesagensComNota.length],
                    ['Divergências Detectadas:', divergencias.length],
                    ['Taxa de Conformidade:', pesagensComNota.length > 0 ? `${(100 - (divergencias.length / pesagensComNota.length) * 100).toFixed(1)}%` : '100%']
                ], { origin: `A${dataRow7}` });
                
                ws7['!cols'] = [{ wch: 30 }, { wch: 50 }];
                if (!ws7['!merges']) ws7['!merges'] = [];
                ws7['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
                ws7['!merges'].push({ s: { r: dataRow7, c: 0 }, e: { r: dataRow7, c: 1 } }); // Indicadores
                ws7['!merges'].push({ s: { r: dataRow7 + 7, c: 0 }, e: { r: dataRow7 + 7, c: 1 } }); // Temporal
                ws7['!merges'].push({ s: { r: dataRow7 + 13, c: 0 }, e: { r: dataRow7 + 13, c: 1 } }); // Destaques
                ws7['!merges'].push({ s: { r: dataRow7 + 19, c: 0 }, e: { r: dataRow7 + 19, c: 1 } }); // Divergências
                ws7['!ref'] = `A1:B${dataRow7 + 25}`;
                XLSX.utils.book_append_sheet(wb, ws7, "Dashboard");

                XLSX.writeFile(wb, nomeArquivo);
                this.showNotification("✅ Excel com 7 abas exportado com sucesso! 📊");
                
                // Registrar log
                this.registrarLog('exportou_excel_multiabas', `Exportou relatório Excel com múltiplas abas: ${titulo}`, {
                    nomeArquivo: nomeArquivo,
                    totalRegistros: pesagens.length,
                    totalAbas: 7
                });
            },

            exportarCSV() {
                const pesagens = this.getFilteredPesagens();
                if (pesagens.length === 0) {
                    this.showNotification("Nenhum dado para exportar.");
                    return;
                }

                const dados = pesagens.map(p => ({
                    'Numero': p.num,
                    'DataEntrada': new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR'),
                    'DataSaida': new Date(p.dataSaida.seconds * 1000).toLocaleDateString('pt-BR'),
                    'Placa': p.placa,
                    'Motorista': p.motorista,
                    'NotaFiscal': this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2),
                    'Cliente': p.cliente,
                    'Transportadora': p.transportadora || '',
                    'RazaoSocial': p.razaoSocial || '',
                    'Obra': p.obra,
                    'Produto': p.produto,
                    'PesoBruto': p.pesoBruto,
                    'Tara': p.tara,
                    'PesoLiquido': p.pesoLiquido
                }));

                const ws = XLSX.utils.json_to_sheet(dados);
                const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' }); // Separador ponto-e-vírgula
                
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                const nomeArquivo = this._gerarNomeRelatorio('csv');
                link.download = nomeArquivo;
                link.click();
                
                // Registrar log
                this.registrarLog('exportou_csv', `Exportou relatório em CSV`, {
                    nomeArquivo: nomeArquivo,
                    totalRegistros: dados.length
                });
                
                this.showNotification("CSV exportado (compatível com ERP)! 📄");
            },

            // ===== EXPORTAÇÃO PERSONALIZADA - NOVAS FUNÇÕES =====
            abrirModalExportacao() {
                const modal = document.getElementById('modal-export-custom');
                modal.classList.add('active');
                
                // Resetar formulário
                document.getElementById('form-export-custom').reset();
                document.querySelectorAll('.export-col-checkbox').forEach(cb => {
                    if(['col-num', 'col-data', 'col-placa', 'col-motorista', 'col-produto', 'col-cliente', 'col-transportadora', 'col-peso-bruto', 'col-tara', 'col-peso-liquido', 'col-nf'].includes(cb.name)) {
                        cb.checked = true;
                    }
                });
                
                // Definir nome do arquivo baseado no filtro atual
                const titulo = this.dom.relatorioTitulo.value.trim() || 'relatorio_balanca';
                document.getElementById('export-filename').value = titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            },

            handleExportacaoPersonalizada() {
                const formato = document.querySelector('input[name="export-format"]:checked').value;
                const filename = document.getElementById('export-filename').value.trim() || 'relatorio_balanca';
                const sortBy = document.getElementById('sort-by').value;
                
                const config = {
                    formato,
                    filename,
                    sortBy,
                    // Opções PDF
                    pdfWatermark: document.querySelector('input[name="pdf-watermark"]')?.checked,
                    watermarkText: document.getElementById('watermark-text')?.value || 'CONFIDENCIAL',
                    pdfLandscape: document.querySelector('input[name="pdf-landscape"]')?.checked,
                    pdfCompress: document.querySelector('input[name="pdf-compress"]')?.checked,
                    // Opções Excel
                    excelFormatting: document.querySelector('input[name="excel-formatting"]')?.checked,
                    excelFormulas: document.querySelector('input[name="excel-formulas"]')?.checked,
                    excelFreeze: document.querySelector('input[name="excel-freeze"]')?.checked,
                    excelAutofilter: document.querySelector('input[name="excel-autofilter"]')?.checked,
                };
                
                this.exportarPersonalizado(config);
            },

            exportarPersonalizado(config) {
                const pesagens = this.getFilteredPesagens();
                
                if (pesagens.length === 0) {
                    this.showNotification('❌ Nenhum dado para exportar!');
                    return;
                }
                
                // Filtrar colunas selecionadas
                const colunasAtivas = Array.from(document.querySelectorAll('.export-col-checkbox:checked')).map(cb => cb.name.replace('col-', ''));
                
                if (colunasAtivas.length === 0) {
                    this.showNotification('❌ Selecione pelo menos uma coluna!');
                    return;
                }
                
                // Ordenar dados
                const dadosOrdenados = this.ordenarDadosExportacao(pesagens, config.sortBy);
                
                // Preparar dados filtrados
                const dadosFiltrados = dadosOrdenados.map(p => {
                    const linha = {};
                    if (colunasAtivas.includes('num')) linha['Nº'] = p.num;
                    if (colunasAtivas.includes('data')) linha['Data'] = new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR');
                    if (colunasAtivas.includes('placa')) linha['Placa'] = p.placa;
                    if (colunasAtivas.includes('motorista')) linha['Motorista'] = p.motorista || '-';
                    if (colunasAtivas.includes('produto')) linha['Produto'] = p.produto;
                    if (colunasAtivas.includes('cliente')) linha['Cliente'] = p.cliente;
                    if (colunasAtivas.includes('transportadora')) linha['Transportadora'] = p.transportadora || '-';
                    if (colunasAtivas.includes('razao-social')) linha['Razão Social'] = p.razaoSocial || '-';
                    if (colunasAtivas.includes('obra')) linha['Obra'] = p.obra || '-';
                    if (colunasAtivas.includes('peso-bruto')) linha['Peso Bruto (kg)'] = p.pesoBruto;
                    if (colunasAtivas.includes('tara')) linha['Tara (kg)'] = p.tara;
                    if (colunasAtivas.includes('peso-liquido')) linha['Peso Líquido (kg)'] = p.pesoLiquido;
                    if (colunasAtivas.includes('nf')) linha['NF'] = this.formatarNotasFiscais(p.notaFiscal, p.notaFiscal2);
                    
                    // Peso da Nota Fiscal (Líquido)
                    const pesoNF = parseFloat(p.pesoNota) || 0;
                    if (colunasAtivas.includes('peso-nf-liquido')) linha['Peso NF Líquido (kg)'] = pesoNF > 0 ? pesoNF : '-';
                    
                    // Diferença e Porcentagem (comparando peso líquido)
                    if (colunasAtivas.includes('diferenca-peso') || colunasAtivas.includes('percentual-diferenca')) {
                        const pesoBalanca = parseFloat(p.pesoLiquido) || 0;
                        const diferenca = pesoNF > 0 ? (pesoBalanca - pesoNF) : 0;
                        const percentual = pesoNF > 0 ? ((diferenca / pesoNF) * 100) : 0;
                        
                        if (colunasAtivas.includes('diferenca-peso')) {
                            linha['⚖️ Diferença (kg)'] = pesoNF > 0 ? diferenca.toFixed(2) : '-';
                        }
                        if (colunasAtivas.includes('percentual-diferenca')) {
                            linha['📈 Diferença (%)'] = pesoNF > 0 ? percentual.toFixed(2) + '%' : '-';
                        }
                    }
                    
                    if (colunasAtivas.includes('certificado')) linha['Certificado'] = p.certificado || '-';
                    if (colunasAtivas.includes('observacoes')) linha['Observações'] = p.observacao || '-';
                    return linha;
                });
                
                // Exportar conforme formato
                switch (config.formato) {
                    case 'pdf':
                        this.exportarPDFPersonalizado(dadosFiltrados, config);
                        break;
                    case 'excel':
                        this.exportarExcelPersonalizado(dadosFiltrados, dadosOrdenados, config);
                        break;
                    case 'csv':
                        this.exportarCSVPersonalizado(dadosFiltrados, config);
                        break;
                    case 'json':
                        this.exportarJSONPersonalizado(dadosOrdenados, config);
                        break;
                }
                
                document.getElementById('modal-export-custom').classList.remove('active');
                this.showNotification(`✅ Exportação concluída! Formato: ${config.formato.toUpperCase()}`);
            },

            ordenarDadosExportacao(pesagens, criterio) {
                const dados = [...pesagens];
                
                switch (criterio) {
                    case 'data-desc':
                        return dados.sort((a, b) => b.dataEntrada.seconds - a.dataEntrada.seconds);
                    case 'data-asc':
                        return dados.sort((a, b) => a.dataEntrada.seconds - b.dataEntrada.seconds);
                    case 'num-desc':
                        return dados.sort((a, b) => b.num - a.num);
                    case 'num-asc':
                        return dados.sort((a, b) => a.num - b.num);
                    case 'peso-desc':
                        return dados.sort((a, b) => b.pesoLiquido - a.pesoLiquido);
                    case 'peso-asc':
                        return dados.sort((a, b) => a.pesoLiquido - b.pesoLiquido);
                    case 'placa':
                        return dados.sort((a, b) => a.placa.localeCompare(b.placa));
                    case 'produto':
                        return dados.sort((a, b) => a.produto.localeCompare(b.produto));
                    default:
                        return dados;
                }
            },

            exportarPDFPersonalizado(dados, config) {
                const { jsPDF } = window.jspdf;
                const orientation = config.pdfLandscape ? 'landscape' : 'portrait';
                const doc = new jsPDF(orientation, 'mm', 'a4');
                
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                
                // Marca d'água (se ativada)
                if (config.pdfWatermark) {
                    doc.setFontSize(60);
                    doc.setTextColor(200, 200, 200);
                    doc.setFont('Helvetica', 'bold');
                    doc.text(config.watermarkText, pageWidth / 2, pageHeight / 2, {
                        align: 'center',
                        angle: 45
                    });
                }
                
                // Cabeçalho
                doc.setFontSize(18);
                doc.setTextColor(13, 148, 136);
                doc.text(this.state.config.nome, 14, 15);
                
                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                doc.text(`Relatório Personalizado - ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);
                
                // Tabela
                const headers = [Object.keys(dados[0] || {})];
                const rows = dados.map(d => Object.values(d));
                
                doc.autoTable({
                    head: headers,
                    body: rows,
                    startY: 28,
                    styles: { fontSize: orientation === 'landscape' ? 8 : 7, cellPadding: 2 },
                    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [245, 245, 245] },
                    margin: { top: 28, left: 14, right: 14 }
                });
                
                // Rodapé
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                    doc.text(this.state.config.footer || 'Gerado pelo Balança Pro+', pageWidth / 2, pageHeight - 6, { align: 'center' });
                }
                
                // Salvar
                const filename = `${config.filename || 'relatorio'}.pdf`;
                doc.save(filename);
                
                // Registrar log
                this.registrarLog('exportou_pdf', { 
                    nomeArquivo: filename, 
                    totalRegistros: dados.length,
                    personalizado: true,
                    opcoes: {
                        marcaDagua: config.pdfWatermark,
                        paisagem: config.pdfLandscape,
                        compressao: config.pdfCompress
                    }
                });
            },

            exportarExcelPersonalizado(dados, dadosCompletos, config) {
                const titulo = config.filename || 'Relatório Personalizado';
                const nomeArquivo = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().getTime()}.xlsx`;
                const configSistema = this.state.config;
                
                if (dados.length === 0) {
                    this.showNotification("⚠️ Nenhum dado para exportar.");
                    return;
                }

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet([]);
                
                let currentRow = 0;
                
                // ===== CABEÇALHO DO RELATÓRIO =====
                XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' });
                currentRow++;
                XLSX.utils.sheet_add_aoa(ws, [[configSistema.nome || 'Empresa']], { origin: 'A2' });
                currentRow++;
                
                const dataInicio = this.dom.filtroDataInicio.value;
                const dataFim = this.dom.filtroDataFim.value;
                let periodo = 'Período: Todos os registros';
                if (dataInicio && dataFim) { 
                    periodo = `Período: ${new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR')}`; 
                }
                XLSX.utils.sheet_add_aoa(ws, [[periodo]], { origin: 'A3' });
                currentRow++;
                XLSX.utils.sheet_add_aoa(ws, [[`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`]], { origin: 'A4' });
                currentRow++;
                
                currentRow++; // Linha em branco
                
                XLSX.utils.sheet_add_aoa(ws, [['EXPORTAÇÃO PERSONALIZADA']], { origin: `A${currentRow + 1}` });
                currentRow++;
                
                currentRow++; // Linha em branco
                
                // ===== TABELA DE DADOS =====
                const dataStartRow = currentRow + 1;
                
                // Adicionar dados usando json_to_sheet
                const wsData = XLSX.utils.json_to_sheet(dados, { origin: `A${dataStartRow}` });
                
                // Copiar dados para a planilha principal
                Object.keys(wsData).forEach(cell => {
                    if (cell[0] !== '!') {
                        ws[cell] = wsData[cell];
                    }
                });
                
                // ===== FORMATAÇÃO =====
                const headers = Object.keys(dados[0] || {});
                const numCols = headers.length;
                
                // Larguras automáticas baseadas no conteúdo
                ws['!cols'] = headers.map(header => {
                    if (header.includes('Ticket')) return { wch: 19.80 };
                    if (header.includes('Nota') && !header.includes('Peso')) return { wch: 15 };
                    if (header.includes('Data')) return { wch: 20 };
                    if (header.includes('Placa')) return { wch: 14 };
                    if (header.includes('Motorista')) return { wch: 28 };
                    if (header.includes('Cliente') || header.includes('Forn')) return { wch: 30 };
                    if (header.includes('Transportadora')) return { wch: 35 };
                    if (header.includes('Razão Social')) return { wch: 35 };
                    if (header.includes('Obra')) return { wch: 25 };
                    if (header.includes('Produto')) return { wch: 30 };
                    if (header.includes('Certificado')) return { wch: 18 };
                    if (header.includes('Peso') || header.includes('Diferença')) return { wch: 18 };
                    if (header.includes('Observ')) return { wch: 50 };
                    return { wch: 20 }; // Padrão
                });
                
                // Auto-filtro (se ativado)
                const lastDataRow = dataStartRow + dados.length - 1;
                if (config.excelAutofilter) {
                    const lastCol = String.fromCharCode(64 + numCols);
                    ws['!autofilter'] = { ref: `A${dataStartRow}:${lastCol}${lastDataRow}` };
                }
                
                // Congelar painéis (se ativado)
                if (config.excelFreeze) {
                    ws['!freeze'] = { xSplit: 0, ySplit: dataStartRow, topLeftCell: `A${dataStartRow + 1}`, state: 'frozen' };
                }
                
                // Adicionar fórmulas de soma (se ativado)
                if (config.excelFormulas) {
                    const colunasNumero = headers
                        .map((h, idx) => ({ nome: h, idx }))
                        .filter(({ nome }) => nome.includes('Peso'));
                    
                    if (colunasNumero.length > 0) {
                        const totalRow = lastDataRow + 1;
                        
                        // Label "TOTAL"
                        XLSX.utils.sheet_add_aoa(ws, [['TOTAL']], { origin: `A${totalRow}` });
                        
                        colunasNumero.forEach(({ idx }) => {
                            const colLetter = String.fromCharCode(65 + idx);
                            const sumCell = `${colLetter}${totalRow}`;
                            ws[sumCell] = { 
                                t: 'n', 
                                f: `SUM(${colLetter}${dataStartRow + 1}:${colLetter}${lastDataRow})` 
                            };
                        });
                    }
                }
                
                // Mesclar células do cabeçalho
                if (!ws['!merges']) ws['!merges'] = [];
                const mergeCols = Math.min(6, numCols);
                ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: mergeCols - 1 } }); // Título
                ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: mergeCols - 1 } }); // Nome empresa
                ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: mergeCols - 1 } }); // Período
                ws['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: mergeCols - 1 } }); // Data geração
                
                // Aplicar formatação condicional (cores por peso) - se ativado
                if (config.excelFormatting) {
                    const pesoColIndex = headers.findIndex(h => h.includes('Peso Líquido'));
                    
                    if (pesoColIndex !== -1) {
                        for (let R = dataStartRow; R <= lastDataRow; ++R) {
                            const cellAddress = XLSX.utils.encode_cell({ r: R, c: pesoColIndex });
                            const cell = ws[cellAddress];
                            
                            if (cell && typeof cell.v === 'number') {
                                const peso = cell.v;
                                if (!cell.s) cell.s = {};
                                
                                if (peso > 20000) {
                                    cell.s = { fill: { fgColor: { rgb: "C6EFCE" } }, font: { color: { rgb: "006100" } } };
                                } else if (peso < 5000) {
                                    cell.s = { fill: { fgColor: { rgb: "FFC7CE" } }, font: { color: { rgb: "9C0006" } } };
                                } else {
                                    cell.s = { fill: { fgColor: { rgb: "FFEB9C" } }, font: { color: { rgb: "9C6500" } } };
                                }
                            }
                        }
                    }
                }
                
                // Calcular range final
                const finalRow = config.excelFormulas ? lastDataRow + 1 : lastDataRow;
                const lastCol = String.fromCharCode(64 + numCols);
                ws['!ref'] = `A1:${lastCol}${finalRow}`;
                
                XLSX.utils.book_append_sheet(wb, ws, "Relatório");
                XLSX.writeFile(wb, nomeArquivo);
                
                this.showNotification('✅ Excel personalizado exportado com sucesso!');
                
                // Registrar log
                this.registrarLog('exportou_excel', { 
                    nomeArquivo: nomeArquivo,
                    totalRegistros: dados.length,
                    personalizado: true,
                    opcoes: {
                        formatacaoCondicional: config.excelFormatting,
                        formulas: config.excelFormulas,
                        congelarPaineis: config.excelFreeze,
                        autoFiltro: config.excelAutofilter
                    }
                });
            },

            exportarCSVPersonalizado(dados, config) {
                const ws = XLSX.utils.json_to_sheet(dados);
                const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
                
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                const filename = `${config.filename || 'relatorio'}.csv`;
                link.download = filename;
                link.click();
                
                // Registrar log
                this.registrarLog('exportou_csv', { 
                    nomeArquivo: filename, 
                    totalRegistros: dados.length,
                    personalizado: true
                });
            },

            exportarJSONPersonalizado(dados, config) {
                const json = JSON.stringify(dados, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                const filename = `${config.filename || 'relatorio'}.json`;
                link.download = filename;
                link.click();
                
                // Registrar log
                this.registrarLog('exportou_json', { 
                    nomeArquivo: filename, 
                    totalRegistros: dados.length,
                    personalizado: true
                });
            },

            salvarFiltroFavorito() {
                const filtro = {
                    titulo: this.dom.relatorioTitulo.value,
                    dataInicio: this.dom.filtroDataInicio.value,
                    dataFim: this.dom.filtroDataFim.value,
                    produto: this.dom.filtroProduto.value,
                    fornecedor: this.dom.filtroFornecedor.value,
                    transportadora: this.dom.filtroTransportadora.value,
                    obra: this.dom.filtroObra.value,
                    periodo: this.state.ultimoPeriodoSelecionado
                };

                localStorage.setItem('balanca_filtro_favorito', JSON.stringify(filtro));
                this.state.filtroFavorito = filtro;
                this.showNotification("⭐ Filtro salvo como favorito!");
            },

            carregarFiltroFavorito() {
                const filtroSalvo = localStorage.getItem('balanca_filtro_favorito');
                if (!filtroSalvo) {
                    this.showNotification("Nenhum filtro favorito salvo ainda.");
                    return;
                }

                const filtro = JSON.parse(filtroSalvo);
                this.dom.relatorioTitulo.value = filtro.titulo || '';
                this.dom.filtroDataInicio.value = filtro.dataInicio || '';
                this.dom.filtroDataFim.value = filtro.dataFim || '';
                this.dom.filtroProduto.value = filtro.produto || '';
                this.dom.filtroFornecedor.value = filtro.fornecedor || '';
                this.dom.filtroTransportadora.value = filtro.transportadora || '';
                this.dom.filtroObra.value = filtro.obra || '';

                if (filtro.periodo) {
                    const btn = document.querySelector(`.filtro-rapido-btn[data-periodo="${filtro.periodo}"]`);
                    if (btn) this.aplicarFiltroRapido(filtro.periodo, btn);
                } else {
                    this.state.reportsCurrentPage = 1;
                    this.renderRelatorios();
                }

                this.showNotification("📂 Filtro favorito carregado!");
            },

            // ===== FILTROS INTELIGENTES AVANÇADOS =====
            aplicarFiltrosAvancados(pesagens) {
                let resultados = [...pesagens];

                // Filtro de Faixa de Peso
                const pesoMin = parseFloat(this.dom.filtroPesoMin?.value);
                const pesoMax = parseFloat(this.dom.filtroPesoMax?.value);
                
                if (!isNaN(pesoMin) || !isNaN(pesoMax)) {
                    resultados = resultados.filter(p => {
                        const peso = p.pesoLiquido || 0;
                        if (!isNaN(pesoMin) && peso < pesoMin) return false;
                        if (!isNaN(pesoMax) && peso > pesoMax) return false;
                        return true;
                    });
                }

                // Filtro de Horário do Dia (Personalizável)
                const horaInicio = this.dom.filtroHoraInicio?.value;
                const horaFim = this.dom.filtroHoraFim?.value;
                
                if (horaInicio || horaFim) {
                    resultados = resultados.filter(p => {
                        const data = new Date(p.dataEntrada.seconds * 1000);
                        const hora = data.getHours();
                        const minuto = data.getMinutes();
                        const horaAtual = hora + (minuto / 60); // Hora decimal para comparação precisa
                        
                        let horaInicioDecimal = 0;
                        let horaFimDecimal = 24;
                        
                        if (horaInicio) {
                            const [h, m] = horaInicio.split(':').map(Number);
                            horaInicioDecimal = h + (m / 60);
                        }
                        
                        if (horaFim) {
                            const [h, m] = horaFim.split(':').map(Number);
                            horaFimDecimal = h + (m / 60);
                        }
                        
                        // Tratamento especial para horários que cruzam meia-noite (ex: 22:00 - 06:00)
                        if (horaFimDecimal < horaInicioDecimal) {
                            return horaAtual >= horaInicioDecimal || horaAtual <= horaFimDecimal;
                        }
                        
                        return horaAtual >= horaInicioDecimal && horaAtual <= horaFimDecimal;
                    });
                }

                // Filtro de Status
                const statusAtivo = this.state.filtrosAvancados.statusAtivo;
                if (statusAtivo) {
                    resultados = resultados.filter(p => {
                        const pesoNF = parseFloat(p.pesoNota) || 0;
                        const pesoBalanca = parseFloat(p.pesoLiquido) || 0;
                        const divergencia = pesoNF > 0 ? Math.abs((pesoBalanca - pesoNF) / pesoNF * 100) : 0;
                        
                        switch(statusAtivo) {
                            case 'com-divergencia': return divergencia > 5;
                            case 'sem-divergencia': return pesoNF > 0 && divergencia <= 5;
                            case 'peso-zerado': return pesoBalanca === 0 || !pesoBalanca;
                            case 'com-certificado': return p.certificado && p.certificado.trim() !== '';
                            case 'sem-certificado': return !p.certificado || p.certificado.trim() === '';
                            default: return true;
                        }
                    });
                }

                // Busca Avançada com Operadores
                const campo1 = this.dom.filtroCampo1?.value;
                const operador1 = this.dom.filtroOperador1?.value;
                const valor1 = this.dom.filtroValor1?.value?.toLowerCase().trim();
                const logico = this.dom.filtroLogico?.value;
                const campo2 = this.dom.filtroCampo2?.value;
                const operador2 = this.dom.filtroOperador2?.value;
                const valor2 = this.dom.filtroValor2?.value?.toLowerCase().trim();

                if (campo1 && valor1) {
                    resultados = resultados.filter(p => {
                        const condicao1 = this.avaliarCondicaoBusca(p, campo1, operador1, valor1);
                        
                        if (!campo2 || !valor2) {
                            return condicao1;
                        }
                        
                        const condicao2 = this.avaliarCondicaoBusca(p, campo2, operador2, valor2);
                        
                        return logico === 'and' ? (condicao1 && condicao2) : (condicao1 || condicao2);
                    });
                }

                return resultados;
            },

            avaliarCondicaoBusca(pesagem, campo, operador, valor) {
                let campoValor = '';
                
                switch(campo) {
                    case 'placa': campoValor = (pesagem.placa || '').toLowerCase(); break;
                    case 'motorista': campoValor = (pesagem.motorista || '').toLowerCase(); break;
                    case 'produto': campoValor = (pesagem.produto || '').toLowerCase(); break;
                    case 'cliente': campoValor = (pesagem.cliente || '').toLowerCase(); break;
                    case 'transportadora': campoValor = (pesagem.transportadora || '').toLowerCase(); break;
                    case 'nf': campoValor = `${pesagem.notaFiscal || ''} ${pesagem.notaFiscal2 || ''}`.toLowerCase(); break;
                    case 'certificado': campoValor = (pesagem.certificado || '').toLowerCase(); break;
                    default: return true;
                }
                
                switch(operador) {
                    case 'contem': return campoValor.includes(valor);
                    case 'igual': return campoValor === valor;
                    case 'diferente': return campoValor !== valor;
                    case 'comeca': return campoValor.startsWith(valor);
                    case 'termina': return campoValor.endsWith(valor);
                    default: return true;
                }
            },

            atualizarBadgeFiltrosAtivos() {
                let contador = 0;
                
                if (this.dom.filtroPesoMin?.value || this.dom.filtroPesoMax?.value) contador++;
                if (this.dom.filtroHoraInicio?.value || this.dom.filtroHoraFim?.value) contador++;
                if (this.state.filtrosAvancados.statusAtivo) contador++;
                if (this.dom.filtroCampo1?.value && this.dom.filtroValor1?.value) contador++;
                if (this.dom.filtroCampo2?.value && this.dom.filtroValor2?.value) contador++;
                
                const badge = this.dom.filtrosAtivosBadge;
                if (contador > 0) {
                    badge.textContent = `🎯 ${contador} filtro${contador > 1 ? 's' : ''} ativo${contador > 1 ? 's' : ''}`;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            },

            limparFiltrosAvancados() {
                // Limpar inputs
                if (this.dom.filtroPesoMin) this.dom.filtroPesoMin.value = '';
                if (this.dom.filtroPesoMax) this.dom.filtroPesoMax.value = '';
                if (this.dom.filtroHoraInicio) this.dom.filtroHoraInicio.value = '';
                if (this.dom.filtroHoraFim) this.dom.filtroHoraFim.value = '';
                if (this.dom.filtroCampo1) this.dom.filtroCampo1.value = '';
                if (this.dom.filtroOperador1) this.dom.filtroOperador1.value = 'contem';
                if (this.dom.filtroValor1) this.dom.filtroValor1.value = '';
                if (this.dom.filtroLogico) this.dom.filtroLogico.value = 'and';
                if (this.dom.filtroCampo2) this.dom.filtroCampo2.value = '';
                if (this.dom.filtroOperador2) this.dom.filtroOperador2.value = 'contem';
                if (this.dom.filtroValor2) this.dom.filtroValor2.value = '';
                
                // Limpar botões ativos
                document.querySelectorAll('.filtro-horario-btn, .filtro-status-btn').forEach(btn => {
                    btn.classList.remove('active', 'bg-purple-600', 'text-white');
                });
                
                // Limpar estado
                this.state.filtrosAvancados.statusAtivo = null;
                
                // Recarregar relatórios
                this.state.reportsCurrentPage = 1;
                this.renderRelatorios();
                this.atualizarBadgeFiltrosAtivos();
                
                this.showNotification("🗑️ Filtros avançados limpos!");
            },

            exportarRelatorioPDFResumo() {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                const pesagens = this.getFilteredPesagens();
                if (pesagens.length === 0) { this.showNotification("⚠️ Nenhum dado para exportar."); return; }

                const metrics = this.computeRelatorioMetrics(pesagens);
                const dataInicio = this.dom.filtroDataInicio.value;
                const dataFim = this.dom.filtroDataFim.value;
                let periodoStr = (dataInicio && dataFim) ? `${new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR')}` : 'Todos os Períodos';

                // Título
                doc.setFontSize(18);
                doc.text('Resumo Executivo de Pesagens', 14, 22);
                doc.setFontSize(11);
                doc.setTextColor(100);
                doc.text(`Período: ${periodoStr}`, 14, 30);

                // Métricas Gerais
                doc.setFontSize(12);
                doc.text('Resumo Geral', 14, 45);
                doc.autoTable({
                    startY: 50,
                    theme: 'grid',
                    head: [['Métrica', 'Valor']],
                    body: [
                        ['Total de Tickets', pesagens.length.toString()],
                        ['Peso Líquido Total', `${this.formatarPeso(metrics.totalLiquido)} kg`],
                        ['Peso Bruto Total', `${this.formatarPeso(metrics.totalBruto)} kg`],
                        ['Peso Tara Total', `${this.formatarPeso(metrics.totalTara)} kg`],
                        ['Peso Líquido Médio por Ticket', `${this.formatarPeso(metrics.mediaLiquido)} kg`]
                    ]
                });

                let finalY = doc.lastAutoTable.finalY || 100;

                // Tabela por Produto
                const produtosData = Object.entries(pesagens.reduce((acc, p) => {
                    if (!acc[p.produto]) acc[p.produto] = { viagens: 0, peso: 0 };
                    acc[p.produto].viagens++;
                    acc[p.produto].peso += p.pesoLiquido;
                    return acc;
                }, {})).sort(([, a], [, b]) => b.peso - a.peso);

                doc.text('Totais por Produto', 14, finalY + 15);
                doc.autoTable({
                    startY: finalY + 20,
                    head: [['Produto', 'Nº Viagens', 'Peso Líquido Total', 'Peso Médio']],
                    body: produtosData.map(([nome, dados]) => [
                        nome,
                        dados.viagens,
                        `${this.formatarPeso(dados.peso)} kg`,
                        `${this.formatarPeso(dados.peso / dados.viagens)} kg`
                    ])
                });

                finalY = doc.lastAutoTable.finalY;

                finalY = doc.lastAutoTable.finalY;

                // Tabela por Fornecedor/Cliente
                const clientesData = Object.entries(pesagens.reduce((acc, p) => {
                    const nome = p.cliente || 'N/A';
                    if (!acc[nome]) acc[nome] = { viagens: 0, peso: 0 };
                    acc[nome].viagens++;
                    acc[nome].peso += p.pesoLiquido;
                    return acc;
                }, {})).sort(([, a], [, b]) => b.peso - a.peso);

                doc.text('Totais por Fornecedor/Cliente', 14, finalY + 15);
                doc.autoTable({
                    startY: finalY + 20,
                    head: [['Fornecedor/Cliente', 'Nº Viagens', 'Peso Líquido Total']],
                    body: clientesData.map(([nome, dados]) => [
                        nome,
                        dados.viagens,
                        `${this.formatarPeso(dados.peso)} kg`
                    ])
                });

                finalY = doc.lastAutoTable.finalY;

                // Tabela por Transportadora
                const transportadorasData = Object.entries(metrics.transportadoras).sort(([, a], [, b]) => b.pesoLiquido - a.pesoLiquido);

                doc.text('Totais por Transportadora', 14, finalY + 15);
                doc.autoTable({
                    startY: finalY + 20,
                    head: [['Transportadora', 'Nº Viagens', 'Peso Líquido Total']],
                    body: transportadorasData.map(([nome, dados]) => [
                        nome,
                        dados.viagens,
                        `${this.formatarPeso(dados.pesoLiquido)} kg`
                    ])
                });

                doc.save(this._gerarNomeRelatorio('pdf').replace('relatorio', 'resumo_executivo'));
            },

            async exportarRelatorioPDFCompleto() {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const pesagens = this.getFilteredPesagens();
                if (pesagens.length === 0) { this.showNotification("⚠️ Nenhum dado para exportar."); return; }

                this.showNotification('Gerando PDF com gráficos... Isso pode levar um momento.');

                // --- Gera Gráficos como Imagens ---
                const chartOptions = { animation: false, responsive: false, devicePixelRatio: 2 };
                const chartToImage = async (chartConfig) => {
                    const offscreenCanvas = document.createElement('canvas');
                    offscreenCanvas.width = 400;
                    offscreenCanvas.height = 200;
                    const ctx = offscreenCanvas.getContext('2d');
                    new Chart(ctx, chartConfig);
                    // Pequeno delay para garantir a renderização completa antes de converter
                    await new Promise(res => setTimeout(res, 500));
                    return offscreenCanvas.toDataURL('image/png');
                };

                // Gráfico 1: Peso por Produto (Pizza)
                const produtoData = pesagens.reduce((acc, p) => { acc[p.produto] = (acc[p.produto] || 0) + p.pesoLiquido; return acc; }, {});
                const top5Produtos = Object.entries(produtoData).sort(([, a], [, b]) => b - a).slice(0, 5);
                const produtoChartConfig = {
                    type: 'pie',
                    data: {
                        labels: top5Produtos.map(p => p[0]),
                        datasets: [{
                            data: top5Produtos.map(p => p[1]),
                            backgroundColor: ['#14b8a6', '#0d9488', '#0f766e', '#047857', '#065f46']
                        }]
                    },
                    options: { ...chartOptions, plugins: { legend: { position: 'top' } } }
                };
                const produtoChartImage = await chartToImage(produtoChartConfig);

                // Gráfico 2: Pesagens por Dia (Barras)
                const diarioData = pesagens.reduce((acc, p) => {
                    const data = new Date(p.dataEntrada.seconds * 1000).toISOString().split('T')[0];
                    if (!acc[data]) acc[data] = 0;
                    acc[data]++;
                    return acc;
                }, {});
                const ultimos7dias = Object.entries(diarioData).sort(([a], [b]) => new Date(a) - new Date(b)).slice(-7);
                const diarioChartConfig = {
                    type: 'bar',
                    data: {
                        labels: ultimos7dias.map(d => new Date(d[0]+'T00:00:00').toLocaleDateString('pt-BR')), 
                        datasets: [{
                            label: 'Nº de Pesagens',
                            data: ultimos7dias.map(d => d[1]),
                            backgroundColor: '#0d9488'
                        }]
                    },
                    options: chartOptions
                };
                const diarioChartImage = await chartToImage(diarioChartConfig);

                // --- Monta o PDF ---
                doc.setFontSize(18);
                doc.text('Relatório Completo com Gráficos', 105, 20, { align: 'center' });

                doc.setFontSize(14);
                doc.text('Peso Líquido por Produto (Top 5)', 105, 40, { align: 'center' });
                doc.addImage(produtoChartImage, 'PNG', 55, 45, 100, 50);

                doc.text('Pesagens por Dia (Últimos 7 dias)', 105, 110, { align: 'center' });
                doc.addImage(diarioChartImage, 'PNG', 30, 115, 150, 75);

                doc.addPage();
                const totalLiquido = pesagens.reduce((sum, p) => sum + p.pesoLiquido, 0);
                doc.setFontSize(12);
                doc.text(`Peso Líquido Total: ${this.formatarPeso(totalLiquido)} kg`, 14, 22);

                doc.text('Todos os Registros', 14, 30);
                
                const body = pesagens.map(p => [p.num, new Date(p.dataEntrada.seconds * 1000).toLocaleDateString('pt-BR'), p.placa, p.produto, `${this.formatarPeso(p.pesoLiquido)} kg`]);
                
                doc.autoTable({
                    startY: 30,
                    head: [['Nº', 'Data', 'Placa', 'Produto', 'P. Líquido']],
                    body: body,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [13, 148, 136] }
                });

                // Total no rodapé da tabela
                const finalY = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text(`Total de Viagens: ${pesagens.length}`, 14, finalY);
                doc.text(`Peso Líquido Total: ${this.formatarPeso(totalLiquido)} kg`, 14, finalY + 5);

                doc.save(this._gerarNomeRelatorio('pdf').replace('relatorio', 'relatorio_graficos'));
            },

            renderDashboardTopProdutos(dados) {
                if (!this.dom.dashboardTopProdutos) return;
                const data = dados.reduce((acc, p) => { acc[p.produto] = (acc[p.produto] || 0) + p.pesoLiquido; return acc; }, {});
                const totalGeral = Object.values(data).reduce((sum, val) => sum + val, 0);
                const sortedProdutos = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 5);
                
                if (sortedProdutos.length === 0) { this.dom.dashboardTopProdutos.innerHTML = `<p class="text-center text-gray-500 text-sm py-4">Nenhum dado.</p>`; return; }

                this.dom.dashboardTopProdutos.innerHTML = sortedProdutos.map(([nome, peso]) => {
                    const percentage = totalGeral > 0 ? ((peso / totalGeral) * 100).toFixed(1) : 0;
                    return `<div><div class="flex justify-between items-center mb-1"><span class="text-sm font-medium text-gray-700 truncate" title="${nome}">${nome}</span><span class="text-sm text-gray-500 flex-shrink-0">${this.formatarPeso(peso)} kg</span></div><div class="w-full bg-gray-200 rounded-full h-2"><div class="h-2 rounded-full" style="width: ${percentage}%; background-color: var(--color-accent);"></div></div></div>`;
                }).join('');
            },
            renderDashboardUltimasPesagens(dados) {
                if (!this.dom.dashboardUltimasPesagens) return;
                const ultimas = dados.sort((a, b) => (b.dataSaida?.seconds || 0) - (a.dataSaida?.seconds || 0)).slice(0, 5);
                this.dom.dashboardUltimasPesagens.innerHTML = ultimas.length > 0 ? ultimas.map(p => `<tr class="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"><td class="p-2 font-mono">${p.placa}</td><td class="p-2 text-gray-600 truncate">${p.produto}</td><td class="p-2 text-right font-semibold">${this.formatarPeso(p.pesoLiquido)} kg</td><td class="p-2 text-center"><button class="text-accent hover:underline text-xs font-bold" data-action="view" data-id="${p.id}">VER</button></td></tr>`).join('') : `<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhuma pesagem recente.</td></tr>`;
            },
            
            // ===== VALIDAÇÃO INTELIGENTE DE PESO DA NOTA =====
            validarPesoNota(input) {
                // Limpar avisos anteriores
                this.limparAvisosPesoNota(input);
                
                const pesoNota = parseFloat(input.value);
                if (!pesoNota || pesoNota <= 0) return;
                
                // Calcular peso BRUTO da balança (soma dos eixos) - apenas na ENTRADA
                const peso1eixo1 = parseFloat(this.dom.entrada.peso1eixo1?.value) || 0;
                const peso1eixo2 = parseFloat(this.dom.entrada.peso1eixo2?.value) || 0;
                const pesoBruto = peso1eixo1 + peso1eixo2;
                
                if (pesoBruto <= 0) return; // Ainda não tem peso da balança
                
                // AVISO: Na entrada, comparamos com PESO BRUTO (não temos tara ainda)
                // A diferença real só pode ser calculada após a saída (peso líquido)
                const diferenca = Math.abs(pesoBruto - pesoNota);
                const percentual = (diferenca / pesoBruto) * 100;
                
                // Criar elemento de aviso
                const avisoDiv = document.createElement('div');
                avisoDiv.className = 'aviso-peso-nota mt-2 p-3 rounded-lg text-sm';
                avisoDiv.id = 'avisoValidacaoPeso';
                
                // Determinar gravidade e cor
                let corBorda = '';
                let corFundo = '';
                let icone = '';
                let titulo = '';
                let mensagem = '';
                
                // IMPORTANTE: Peso da nota deve ser comparado com PESO LÍQUIDO
                // Como estamos na entrada, só temos PESO BRUTO
                // Então mostramos um aviso informativo
                
                if (pesoNota > pesoBruto) {
                    // ALERTA: Peso da nota MAIOR que peso bruto - impossível!
                    corBorda = 'border-red-500 animate-pulse';
                    corFundo = 'bg-red-50';
                    icone = '🚨';
                    titulo = 'PESO DA NOTA MAIOR QUE PESO BRUTO!';
                    mensagem = `O peso da nota (${this.formatarPeso(pesoNota)} kg) não pode ser maior que o peso bruto da balança (${this.formatarPeso(pesoBruto)} kg). Verifique os valores!`;
                } else {
                    // Apenas informativo - a comparação real será com o peso líquido
                    corBorda = 'border-blue-500';
                    corFundo = 'bg-blue-50';
                    icone = 'ℹ️';
                    titulo = 'Peso da Nota registrado';
                    mensagem = `Peso Bruto: ${this.formatarPeso(pesoBruto)} kg | Peso da Nota: ${this.formatarPeso(pesoNota)} kg<br><small class="text-blue-500">💡 A diferença será calculada com o Peso Líquido após a saída (Peso Bruto - Tara)</small>`;
                }
                
                avisoDiv.innerHTML = `
                    <div class="flex items-start gap-2">
                        <span class="text-lg">${icone}</span>
                        <div class="flex-1">
                            <div class="font-semibold ${pesoNota > pesoBruto ? 'text-red-700' : 'text-blue-700'}">${titulo}</div>
                            <div class="${pesoNota > pesoBruto ? 'text-red-600' : 'text-blue-600'}">${mensagem}</div>
                        </div>
                    </div>
                `;
                
                avisoDiv.className += ` ${corFundo} border-l-4 ${corBorda}`;
                input.className = input.className.replace(/border-(green|yellow|red|blue)-\d+/g, '');
                input.classList.add(corBorda.split(' ')[0]);
                
                // Inserir aviso após o campo
                input.parentElement.appendChild(avisoDiv);
            },
            
            detectarErrosDigitacao(pesoNota, pesoBalanca) {
                const sugestoes = [];
                
                // Erro de zero a menos (ex: 1000 em vez de 10000)
                if (Math.abs(pesoBalanca - pesoNota * 10) < pesoBalanca * 0.03) {
                    sugestoes.push(`💡 Faltou um zero? Tente: <strong>${this.formatarPeso(pesoNota * 10)} kg</strong>`);
                }
                
                // Erro de zero a mais (ex: 10000 em vez de 1000)
                if (Math.abs(pesoBalanca - pesoNota / 10) < pesoBalanca * 0.03) {
                    sugestoes.push(`💡 Zero a mais? Tente: <strong>${this.formatarPeso(pesoNota / 10)} kg</strong>`);
                }
                
                // Erro de 100x (ex: 100 em vez de 10000)
                if (Math.abs(pesoBalanca - pesoNota * 100) < pesoBalanca * 0.03) {
                    sugestoes.push(`💡 Faltaram dois zeros? Tente: <strong>${this.formatarPeso(pesoNota * 100)} kg</strong>`);
                }
                
                // Erro de vírgula (ex: 1000 em vez de 10000)
                const pesoNotaStr = pesoNota.toString();
                if (pesoNotaStr.includes('.')) {
                    const semVirgula = parseFloat(pesoNotaStr.replace('.', ''));
                    if (Math.abs(pesoBalanca - semVirgula) < pesoBalanca * 0.03) {
                        sugestoes.push(`💡 Problema na vírgula? Tente: <strong>${this.formatarPeso(semVirgula)} kg</strong>`);
                    }
                }
                
                // Inversão de dígitos adjacentes (ex: 1234 em vez de 1324)
                const pesoNotaDigits = pesoNotaStr.replace('.', '').split('');
                for (let i = 0; i < pesoNotaDigits.length - 1; i++) {
                    const temp = [...pesoNotaDigits];
                    [temp[i], temp[i + 1]] = [temp[i + 1], temp[i]];
                    const invertido = parseFloat(temp.join(''));
                    if (Math.abs(pesoBalanca - invertido) < pesoBalanca * 0.03) {
                        sugestoes.push(`💡 Dígitos invertidos? Tente: <strong>${this.formatarPeso(invertido)} kg</strong>`);
                        break;
                    }
                }
                
                if (sugestoes.length > 0) {
                    return `<div class="mt-2 text-red-700 space-y-1">${sugestoes.join('<br>')}</div>`;
                }
                return '';
            },
            
            atualizarValidacaoPesoNota() {
                // Re-validar quando o peso da balança mudar
                if (this.dom.entrada.pesoNota && this.dom.entrada.pesoNota.value) {
                    this.validarPesoNota(this.dom.entrada.pesoNota);
                }
            },
            
            limparAvisosPesoNota(input) {
                // Remover aviso anterior
                const avisoAnterior = document.getElementById('avisoValidacaoPeso');
                if (avisoAnterior) {
                    avisoAnterior.remove();
                }
                
                // Remover classes de borda colorida
                input.className = input.className.replace(/border-(green|yellow|red|blue)-\d+/g, '');
            },
            
                        async handleVisualizarEntrada(id) {
                try {
                    const pesagemPendente = this.state.pesagensPendentes.find(p => p.id === id);
                    if (!pesagemPendente) {
                        this.showNotification('❌ Pesagem não encontrada.');
                        return;
                    }
                    this.state.currentTicket = pesagemPendente;
                    this.preencherTicketEntrada(pesagemPendente); // Usar a função correta para preencher o modal
                    this.dom.modalTicket.classList.add('active');
                } catch (error) {
                    console.error("❌ Erro ao visualizar entrada:", error);
                    this.showNotification('❌ Erro ao preparar a visualização.');
                }
            },

            async handleEditTicket(id, isPendente = false) {
                const pesagem = isPendente
                    ? this.state.pesagensPendentes.find(p => p.id === id)
                    : this.state.pesagensCompletas.find(p => p.id === id);

                if (!pesagem) {
                    this.showNotification('❌ Registro não encontrado.');
                    return;
                }

                this.state.editingTicketId = id;
                this.state.isEditingPendente = isPendente;
                this.state.ticketToEdit = pesagem; // Armazena o ticket que está sendo editado

                const form = this.dom.formEditTicket;

                // Cadastros podem ser strings simples ou objetos {nome: '...'}
                const produtosOptions = this.state.produtos.filter(p => p).map(p => {
                    const nome = typeof p === 'string' ? p : p.nome;
                    return `<option value="${nome}" ${pesagem.produto === nome ? 'selected' : ''}>${nome}</option>`;
                }).join('');
                const obrasOptions = this.state.obras.filter(o => o).map(o => {
                    const nome = typeof o === 'string' ? o : o.nome;
                    return `<option value="${nome}" ${(pesagem.obra || '') === nome ? 'selected' : ''}>${nome}</option>`;
                }).join('');
                const clientesOptions = this.state.fornecedores.filter(f => f).map(f => {
                    const nome = typeof f === 'string' ? f : f.nome;
                    return `<option value="${nome}" ${(pesagem.cliente || '') === nome ? 'selected' : ''}>${nome}</option>`;
                }).join('');
                const transportadorasOptions = this.state.transportadoras.filter(t => t).map(t => {
                    const nome = typeof t === 'string' ? t : t.nome;
                    return `<option value="${nome}" ${(pesagem.transportadora || '') === nome ? 'selected' : ''}>${nome}</option>`;
                }).join('');

                // Determina se os campos de peso devem ser editáveis
                const isCompleto = !isPendente;
                const pesoFieldRequirement = isCompleto ? 'required' : '';
                const pesoFieldPlaceholder = isPendente ? 'placeholder="Preencha na saída"' : '';

                let pesoEntradaInfo = '';
                if (isPendente) {
                    const formatPeso = (valor) => (typeof valor === 'number' && !isNaN(valor)) ? `${this.formatarPeso(valor)} kg` : '—';
                    if (pesagem.isPesagemDupla) {
                        const eixo1 = formatPeso(pesagem.peso1_eixo1);
                        const eixo2 = formatPeso(pesagem.peso1_eixo2);
                        const total = formatPeso(pesagem.peso1);
                        pesoEntradaInfo = `
                            <div class="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 peso-entrada-info">
                                <p class="font-semibold">📥 Peso registrado na entrada</p>
                                <div class="mt-2 grid gap-2 sm:grid-cols-3">
                                    <div><span class="block text-xs text-gray-500 peso-entrada-label">Eixo 1</span><span class="font-mono font-semibold">${eixo1}</span></div>
                                    <div><span class="block text-xs text-gray-500 peso-entrada-label">Eixo 2</span><span class="font-mono font-semibold">${eixo2}</span></div>
                                    <div><span class="block text-xs text-gray-500 peso-entrada-label">Total</span><span class="font-mono font-semibold">${total}</span></div>
                                </div>
                            </div>`;
                    } else {
                        const pesoUnico = formatPeso(pesagem.peso1 ?? pesagem.pesoBruto ?? pesagem.tara);
                        pesoEntradaInfo = `
                            <div class="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 peso-entrada-info">
                                <p class="font-semibold">📥 Peso registrado na entrada</p>
                                <p class="mt-2 font-mono text-base font-semibold">${pesoUnico}</p>
                            </div>`;
                    }
                }

                form.innerHTML = `
                    <input type="hidden" id="edit-id" value="${pesagem.id}">
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b pb-4">
                        <div>
                            <label class="text-sm font-medium text-gray-700">🎫 Nº Ticket</label>
                            <input type="text" id="edit-ticket-num" value="${pesagem.num || 'PENDENTE'}" class="mt-1 w-full p-2 border border-gray-300 rounded-md font-mono bg-gray-100" readonly>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">🚗 Placa</label>
                            <input type="text" id="edit-placa" value="${pesagem.placa || ''}" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required maxlength="7" style="text-transform:uppercase">
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">👤 Motorista</label>
                            <input type="text" id="edit-motorista" value="${pesagem.motorista || ''}" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">📄 Nota Fiscal</label>
                            <input type="text" id="edit-nf" value="${pesagem.notaFiscal === '*' ? '' : (pesagem.notaFiscal || '')}" class="mt-1 w-full p-2 border border-gray-300 rounded-md">
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">⚖️ Peso da Nota (kg)</label>
                            <input type="number" step="0.01" id="edit-peso-nota" value="${pesagem.pesoNota || ''}" class="mt-1 w-full p-2 border border-gray-300 rounded-md" placeholder="Opcional">
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">📄 2ª Nota Fiscal</label>
                            <input type="text" id="edit-nf2" value="${pesagem.notaFiscal2 || ''}" class="mt-1 w-full p-2 border border-gray-300 rounded-md">
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">📦 Produto</label>
                            <select id="edit-produto" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required>${produtosOptions}</select>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">🏗️ Obra</label>
                            <select id="edit-obra" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required>
                                <option value="" ${!pesagem.obra ? 'selected' : ''}>Selecione uma obra</option>${obrasOptions}
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">🏢 Cliente</label>
                            <select id="edit-cliente" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required>
                                <option value="" ${!pesagem.cliente ? 'selected' : ''}>Selecione um cliente</option>${clientesOptions}
                            </select>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">🚛 Transportadora</label>
                            <select id="edit-transportadora" class="mt-1 w-full p-2 border border-gray-300 rounded-md">
                                <option value="" ${!pesagem.transportadora ? 'selected' : ''}>Sem transportadora</option>${transportadorasOptions}
                            </select>
                        </div>
                    </div>
                    ${pesoEntradaInfo}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-4 mt-4">
                         <div>
                            <label class="text-sm font-medium text-gray-700">⚖️ Peso Bruto (kg)</label>
                                     <input type="number" step="0.01" id="edit-peso-bruto" value="${pesagem.pesoBruto || ''}" class="mt-1 w-full p-2 border border-gray-300 rounded-md" ${pesoFieldPlaceholder} ${pesoFieldRequirement}>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700">🏋️ Tara (kg)</label>
                                     <input type="number" step="0.01" id="edit-tara" value="${pesagem.tara || ''}" class="mt-1 w-full p-2 border border-gray-300 rounded-md" ${pesoFieldPlaceholder} ${pesoFieldRequirement}>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <label class="text-sm font-medium text-gray-700">📝 Observação</label>
                        <textarea id="edit-observacao" rows="3" class="mt-1 w-full p-2 border border-gray-300 rounded-md">${pesagem.observacao || ''}</textarea>
                    </div>
                    
                    <div class="flex justify-end gap-3 pt-4">
                        <button type="button" id="btn-cancel-edit" class="bg-gray-200 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">❌ Cancelar</button>
                        <button type="submit" id="btn-submit-edit" class="btn-primary text-white font-semibold py-2 px-6 rounded-md">💾 Salvar Alterações</button>
                    </div>
                `;

                form.querySelector('#btn-cancel-edit').addEventListener('click', () => { this.dom.modalEditTicket.classList.remove('active'); this.state.ticketToEdit = null; });
                form.querySelector('#edit-placa').addEventListener('input', (e) => this.formatarPlaca(e.target));

                this.dom.modalEditTicket.classList.add('active');
            },
            async handleUpdateTicketSubmit(e) {
                e.preventDefault();
                const submitButton = document.getElementById('btn-submit-edit');
                if (submitButton.disabled) return;

                try {
                    submitButton.disabled = true;
                    submitButton.textContent = 'A guardar...';

                    const originalTicket = this.state.ticketToEdit;
                    if (!originalTicket || !originalTicket.id) { throw new Error("ID do ticket inválido."); }

                    const get = (elId) => document.getElementById(elId).value;
                    
                    const isPendente = this.state.isEditingPendente;
                    const pesoBrutoValor = get('edit-peso-bruto');
                    const taraValor = get('edit-tara');
                    const pesoBruto = parseFloat(pesoBrutoValor);
                    const tara = parseFloat(taraValor);
                    const pesoBrutoInformado = !isNaN(pesoBruto);
                    const taraInformada = !isNaN(tara);

                    if (!isPendente && (!pesoBrutoInformado || !taraInformada)) {
                        this.showNotification("⚠️ Pesos devem ser números.");
                        submitButton.disabled = false;
                        submitButton.textContent = '💾 Salvar Alterações';
                        return;
                    }

                    const nomeProduto = get('edit-produto');
                    const produtoInfo = this.state.produtos.find(p => p.nome === nomeProduto);

                    const notaFiscalPrincipal = get('edit-nf').trim();
                    const nf2Input = document.getElementById('edit-nf2');
                    const notaFiscalSecundaria = nf2Input ? nf2Input.value.trim() : '';
                    
                    // NOVO: Obter peso da nota
                    const pesoNotaInput = document.getElementById('edit-peso-nota');
                    const pesoNotaValue = pesoNotaInput ? pesoNotaInput.value.trim() : '';
                    const pesoNota = pesoNotaValue ? parseFloat(pesoNotaValue) : null;

                    const dataToUpdate = {
                        placa: get('edit-placa').toUpperCase(), motorista: get('edit-motorista'),
                        notaFiscal: notaFiscalPrincipal || '*', notaFiscal2: notaFiscalSecundaria ? notaFiscalSecundaria : null, 
                        pesoNota: pesoNota, // NOVO: Incluir peso da nota
                        produto: nomeProduto,
                        certificado: produtoInfo ? produtoInfo.certificado : '',
                        obra: get('edit-obra'), cliente: get('edit-cliente'), transportadora: get('edit-transportadora'),
                        observacao: get('edit-observacao'),
                    };

                    if (!isPendente && pesoBrutoInformado && taraInformada) {
                        dataToUpdate.pesoBruto = pesoBruto;
                        dataToUpdate.tara = tara;
                        dataToUpdate.pesoLiquido = Math.abs(pesoBruto - tara);
                    } else {
                        if (pesoBrutoInformado) { dataToUpdate.pesoBruto = pesoBruto; }
                        if (taraInformada) { dataToUpdate.tara = tara; }
                        if (pesoBrutoInformado && taraInformada) { dataToUpdate.pesoLiquido = Math.abs(pesoBruto - tara); }
                    }
                    
                    const collectionName = isPendente ? 'pesagensPendentes' : 'pesagensCompletas';
                    await setDoc(doc(this.state.db, collectionName, originalTicket.id), dataToUpdate, { merge: true });

                    // Registrar log
                    const logDescricao = isPendente
                        ? `Atualizou entrada pendente - Placa: ${dataToUpdate.placa}`
                        : `Editou ticket #${originalTicket.num} - Placa: ${dataToUpdate.placa}`;

                    await this.registrarLog('editou_ticket', logDescricao, {
                        ...(isPendente ? { pendenteId: originalTicket.id } : { ticketId: originalTicket.id, ticketNum: originalTicket.num }),
                        placa: dataToUpdate.placa,
                        alteracoes: dataToUpdate
                    });

                    this.showNotification("✅ Ticket alterado com sucesso!");
                    this.dom.modalEditTicket.classList.remove('active');
                    this.state.ticketToEdit = null;
                } catch (error) {
                    console.error("Erro ao alterar o ticket:", error);
                    this.showNotification("❌ Erro ao guardar as alterações.");
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = '💾 Salvar Alterações';
                        submitButton.textContent = 'Salvar Alterações';
                    }
                }
            }
        };
        
        // Função global para toggle de senha
        window.togglePasswordVisibility = function(inputId) {
            const input = document.getElementById(inputId);
            input.type = input.type === 'password' ? 'text' : 'password';
        };
        
        // ===== DARK MODE TOGGLE =====
        window.toggleDarkMode = function() {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            console.log(`🎨 Tema alterado para: ${newTheme}`);
        };
        
        // Forçar tema claro ao carregar
        (function loadTheme() {
            const forcedTheme = 'light';
            document.documentElement.setAttribute('data-theme', forcedTheme);
            localStorage.setItem('theme', forcedTheme);
        })();
        
        // Expor App globalmente para uso nos botões inline
        window.App = App;
        
        document.addEventListener('DOMContentLoaded', () => App.init());
        
        // ===== PWA - SERVICE WORKER REGISTRATION =====
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then((registration) => {
                        console.log('✅ Service Worker registrado:', registration.scope);
                        
                        // Verificar atualizações
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('🔄 Nova versão disponível!');
                                    if (confirm('Nova versão disponível! Deseja atualizar?')) {
                                        window.location.reload();
                                    }
                                }
                            });
                        });
                    })
                    .catch((error) => {
                        console.error('❌ Erro ao registrar Service Worker:', error);
                    });
            });
        }
        
        // ===== PWA - INSTALL PROMPT =====
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Mostrar botão de instalação
            const installBtn = document.getElementById('btn-install-pwa');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.classList.remove('hidden');
            }
        });
        
        window.installPWA = async function() {
            if (!deferredPrompt) {
                alert('App já está instalado ou não pode ser instalado neste navegador.');
                return;
            }
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('✅ PWA instalado com sucesso!');
            } else {
                console.log('❌ Instalação cancelada pelo usuário');
            }
            
            deferredPrompt = null;
            const installBtn = document.getElementById('btn-install-pwa');
            if (installBtn) {
                installBtn.style.display = 'none';
            }
        };
        
        // Detectar quando app está instalado
        window.addEventListener('appinstalled', () => {
            console.log('🎉 PWA instalado!');
            deferredPrompt = null;
        });
        
        // Verificar se está rodando como PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('📱 Rodando como PWA instalado');
            document.body.classList.add('pwa-mode');
        }
