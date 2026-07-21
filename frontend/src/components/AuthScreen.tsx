import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import styles from './AuthScreen.module.css';
import { Stethoscope, AlertCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de Convite
  const [inviteTenantId, setInviteTenantId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [inviteTenantName, setInviteTenantName] = useState<string | null>(null);
  const [inviteUnitId, setInviteUnitId] = useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tenantId = params.get('invite_tenant_id');
    const roleParam = params.get('role');
    const tenantName = params.get('tenant_name');
    const unitIdParam = params.get('unit_id');

    if (tenantId && roleParam) {
      setInviteTenantId(tenantId);
      setInviteRole(roleParam);
      setInviteTenantName(tenantName || 'Clínica Convidada');
      setInviteUnitId(unitIdParam || null);
      setIsSignUp(true); // Redireciona para o cadastro
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isSignUp) {
        // Fluxo de Cadastro de nova clínica ou usuário convidado
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role: inviteRole || 'clinic_owner',
              company_name: inviteRole ? undefined : companyName,
              invited_tenant_id: inviteTenantId || undefined,
              invited_unit_id: inviteUnitId || undefined,
              phone,
            },
          },
        });

        if (signUpError) throw signUpError;
        setSuccessMsg(
          'Clínica cadastrada com sucesso! Verifique seu e-mail para confirmar a conta ou tente fazer o login.'
        );
        // Limpar os campos
        setName('');
        setCompanyName('');
        setPhone('');
        setEmail('');
        setPassword('');
        setIsSignUp(false);
      } else {
        // Fluxo de Login tradicional
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      }
    } catch (err: any) {
      console.error('Erro na autenticação:', err);
      setError(err.message || 'Erro inesperado na operação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.glow + ' ' + styles.glowLeft}></div>
      <div className={styles.glow + ' ' + styles.glowRight}></div>

      <div className={styles.card}>
        <div className={styles.logoArea}>
          <Stethoscope size={36} className={styles.logoIcon} />
          <span className={styles.title}>ControleODONTO</span>
        </div>

        <p className={styles.subtitle}>
          {isSignUp
            ? 'Crie sua conta administrativa e configure o espaço da sua nova clínica em poucos passos.'
            : 'Faça login para gerenciar sua agenda, pacientes e fluxo clínico.'}
        </p>

        {error && (
          <div className={styles.error}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#a7f3d0',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            {successMsg}
          </div>
        )}

        {inviteTenantId && isSignUp && (
          <div style={{
            background: 'rgba(20, 184, 166, 0.1)',
            border: '1px solid rgba(20, 184, 166, 0.2)',
            color: '#99f6e4',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            Você foi convidado a participar da clínica <strong>{inviteTenantName}</strong> como <strong>{inviteRole === 'dentist' ? 'Dentista' : inviteRole === 'receptionist' ? 'Recepção' : inviteRole === 'finance' ? 'Financeiro' : inviteRole}</strong>. Crie sua conta abaixo para aceitar.
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <div className={styles.group}>
                <label className={styles.label}>Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dra. Beatriz Santos"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {!inviteTenantId && (
                <div className={styles.group}>
                  <label className={styles.label}>Nome da Clínica / Consultório</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: OdontoPlus Matriz"
                    className={styles.input}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              )}

              <div className={styles.group}>
                <label className={styles.label}>Telefone de Contato</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: (11) 98765-4321"
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <div className={styles.group}>
            <label className={styles.label}>E-mail</label>
            <input
              type="email"
              required
              placeholder="seuemail@exemplo.com"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>Senha</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? 'Processando...' : isSignUp ? 'Criar Clínica & Conta' : 'Acessar Painel'}
          </button>
        </form>

        <div className={styles.footer}>
          {isSignUp ? (
            <>
              Já possui uma clínica no sistema?{' '}
              <span className={styles.link} onClick={() => setIsSignUp(false)}>
                Fazer Login
              </span>
            </>
          ) : (
            <>
              Quer usar o sistema na sua clínica?{' '}
              <span className={styles.link} onClick={() => setIsSignUp(true)}>
                Cadastrar Nova Clínica
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
