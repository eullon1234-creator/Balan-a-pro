/**
 * Módulo de Segurança - Balança Pro+
 * Implementa: Hash de senhas, sanitização, proteção contra ataques
 */

window.SecurityModule = (function() {
    'use strict';

    // ===== HASH DE SENHAS COM SHA-256 =====
    async function hashPassword(password) {
        if (!password || typeof password !== 'string') {
            throw new Error('Senha inválida');
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    }

    // ===== VERIFICAR SENHA COM HASH =====
    async function verifyPassword(password, hashedPassword) {
        if (!password || !hashedPassword) {
            return false;
        }
        
        const hash = await hashPassword(password);
        return hash === hashedPassword;
    }

    // ===== GERAR SALT ÚNICO =====
    function generateSalt() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ===== HASH COM SALT =====
    async function hashPasswordWithSalt(password, salt) {
        if (!salt) {
            salt = generateSalt();
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return {
            hash: hashHex,
            salt: salt
        };
    }

    // ===== VERIFICAR SENHA COM SALT =====
    async function verifyPasswordWithSalt(password, hashedPassword, salt) {
        if (!password || !hashedPassword || !salt) {
            return false;
        }
        
        const result = await hashPasswordWithSalt(password, salt);
        return result.hash === hashedPassword;
    }

    // ===== SANITIZAÇÃO DE INPUTS =====
    function sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }
        
        // Remover tags HTML e scripts maliciosos
        const div = document.createElement('div');
        div.textContent = input;
        let sanitized = div.innerHTML;
        
        // Remover caracteres especiais perigosos
        sanitized = sanitized.replace(/[<>\"\'&]/g, function(char) {
            const entities = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;'
            };
            return entities[char] || char;
        });
        
        // Limitar tamanho máximo
        return sanitized.substring(0, 500);
    }

    // ===== VALIDAR EMAIL =====
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // ===== VALIDAR SENHA FORTE =====
    function validatePasswordStrength(password) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        const passed = Object.values(checks).filter(Boolean).length;
        
        if (passed < 4) {
            return {
                isValid: false,
                message: 'Senha deve ter: mínimo 8 caracteres, letra maiúscula, minúscula, número e caractere especial'
            };
        }
        
        return { isValid: true, message: 'Senha forte' };
    }

    // ===== PROTEÇÃO CONTRA XSS =====
    function escapeHTML(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag]));
    }

    // ===== LIMITADOR DE TENTATIVAS DE LOGIN =====
    class LoginAttemptLimiter {
        constructor(maxAttempts = 5, lockoutDuration = 15 * 60 * 1000) {
            this.maxAttempts = maxAttempts;
            this.lockoutDuration = lockoutDuration;
            this.attempts = new Map();
        }

        recordAttempt(email) {
            const now = Date.now();
            const attempt = this.attempts.get(email) || { count: 0, lastAttempt: 0, lockedUntil: 0 };
            
            if (now < attempt.lockedUntil) {
                return {
                    allowed: false,
                    lockedUntil: attempt.lockedUntil,
                    remainingTime: attempt.lockedUntil - now
                };
            }
            
            attempt.count = attempt.lastAttempt && (now - attempt.lastAttempt) > 300000 ? 1 : attempt.count + 1;
            attempt.lastAttempt = now;
            
            if (attempt.count >= this.maxAttempts) {
                attempt.lockedUntil = now + this.lockoutDuration;
            }
            
            this.attempts.set(email, attempt);
            
            return {
                allowed: attempt.count < this.maxAttempts,
                attemptsRemaining: Math.max(0, this.maxAttempts - attempt.count),
                lockedUntil: attempt.lockedUntil
            };
        }

        resetAttempts(email) {
            this.attempts.delete(email);
        }

        isLocked(email) {
            const attempt = this.attempts.get(email);
            if (!attempt) return false;
            
            const now = Date.now();
            return now < attempt.lockedUntil;
        }

        getLockTimeRemaining(email) {
            const attempt = this.attempts.get(email);
            if (!attempt) return 0;
            
            const now = Date.now();
            return Math.max(0, attempt.lockedUntil - now);
        }
    }

    // ===== TIMEOUT DE SESSÃO =====
    class SessionTimeout {
        constructor(timeoutDuration = 30 * 60 * 1000, onTimeout) {
            this.timeoutDuration = timeoutDuration;
            this.onTimeout = onTimeout;
            this.lastActivity = Date.now();
            this.timer = null;
            this.enabled = true;
            
            this.bindEvents();
            this.startTimer();
        }

        bindEvents() {
            const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
            events.forEach(event => {
                document.addEventListener(event, () => this.resetTimer(), true);
            });
        }

        startTimer() {
            if (!this.enabled) return;
            
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                if (this.enabled && Date.now() - this.lastActivity >= this.timeoutDuration) {
                    this.onTimeout && this.onTimeout();
                }
            }, this.timeoutDuration);
        }

        resetTimer() {
            this.lastActivity = Date.now();
            this.startTimer();
        }

        disable() {
            this.enabled = false;
            clearTimeout(this.timer);
        }

        enable() {
            this.enabled = true;
            this.lastActivity = Date.now();
            this.startTimer();
        }
    }

    // ===== EXPORTAR FUNÇÕES PÚBLICAS =====
    return {
        hashPassword,
        verifyPassword,
        hashPasswordWithSalt,
        verifyPasswordWithSalt,
        generateSalt,
        sanitizeInput,
        isValidEmail,
        validatePasswordStrength,
        escapeHTML,
        LoginAttemptLimiter,
        SessionTimeout
    };
})();

console.log('✅ SecurityModule carregado');
