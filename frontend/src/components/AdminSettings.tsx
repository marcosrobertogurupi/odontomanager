import React, { useEffect, useState } from 'react';
import { 
  Building, 
  Settings, 
  ShieldCheck, 
  Plus, 
  Users,
  Activity,
  CreditCard,
  ToggleLeft,
  ToggleRight,
  Image,
  Upload,
  Trash2
} from 'lucide-react';
import styles from './AdminSettings.module.css';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabaseClient';

interface Unit {
  id: string;
  name: string;
  address: string;
}

interface Procedure {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface TenantModel {
  id: string;
  nome_clinica: string;
  plano: 'Básico' | 'Pro' | 'Multi-unidade';
  status_assinatura: 'ativo' | 'inadimplente' | 'cancelado';
  limite_usuarios: number;
  limite_unidades: number;
  data_inicio: string;
}

interface AdminSettingsProps {
  units: Unit[];
  fetchUnits: () => void;
}

export default function AdminSettings({ units, fetchUnits }: AdminSettingsProps) {
  const { activeTenant, role, updateTenantLogo } = useTenant();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [tenants, setTenants] = useState<TenantModel[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Novo Procedimento
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');

  // Nova Unidade
  const [unitName, setUnitName] = useState('');
  const [unitAddress, setUnitAddress] = useState('');

  // Membros da Equipe
  const [staff, setStaff] = useState<any[]>([]);
  const [inviteRole, setInviteRole] = useState<'dentist' | 'receptionist' | 'finance'>('dentist');
  const [inviteLink, setInviteLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchProcedures = async () => {
    if (!activeTenant) return;
    try {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name');
      if (error) throw error;
      setProcedures(data || []);
    } catch (err) {
      console.error('Erro ao buscar procedimentos:', err);
    }
  };

  const fetchStaff = async () => {
    if (!activeTenant) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name');
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error('Erro ao buscar equipe:', err);
    }
  };

  const handleRemoveStaff = async (profileId: string) => {
    if (!activeTenant) return;
    if (!confirm('Deseja realmente remover este membro da clínica?')) return;
    try {
      // 1. Remover da tabela users_tenants
      const { error: assocError } = await supabase
        .from('users_tenants')
        .delete()
        .eq('user_id', profileId)
        .eq('tenant_id', activeTenant.id);

      if (assocError) throw assocError;

      // 2. Desvincular o tenant_id na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ tenant_id: null, unit_id: null })
        .eq('id', profileId);

      if (profileError) throw profileError;

      fetchStaff();
      alert('Membro removido com sucesso!');
    } catch (err: any) {
      console.error('Erro ao remover membro:', err);
      alert('Erro ao remover membro: ' + err.message);
    }
  };

  const generateInviteLink = () => {
    if (!activeTenant) return;
    const link = `${window.location.origin}?invite_tenant_id=${activeTenant.id}&role=${inviteRole}&tenant_name=${encodeURIComponent(activeTenant.nome_clinica)}`;
    setInviteLink(link);
    setCopiedLink(false);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const fetchAllTenants = async () => {
    if (role !== 'super_admin') return;
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('nome_clinica');
      if (error) throw error;
      setTenants(data || []);
    } catch (err) {
      console.error('Erro ao buscar clínicas do SaaS:', err);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTenant) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert('Por favor, envie apenas imagens PNG, JPG/JPEG ou SVG.');
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('A imagem deve ter no máximo 2MB.');
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${activeTenant.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('clinic-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clinic-logos')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('tenants')
        .update({ logo_url: publicUrl })
        .eq('id', activeTenant.id);

      if (dbError) throw dbError;

      updateTenantLogo(publicUrl);
      alert('Logomarca atualizada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao enviar logomarca:', err);
      alert('Erro ao enviar: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!activeTenant) return;
    if (!confirm('Deseja realmente remover a logomarca da clínica?')) return;

    try {
      setUploading(true);

      const { error: dbError } = await supabase
        .from('tenants')
        .update({ logo_url: null })
        .eq('id', activeTenant.id);

      if (dbError) throw dbError;

      updateTenantLogo(null);
      alert('Logomarca removida com sucesso!');
    } catch (err: any) {
      console.error('Erro ao remover logomarca:', err);
      alert('Erro ao remover: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (activeTenant) {
      fetchProcedures();
      fetchStaff();
    }
    if (role === 'super_admin') {
      fetchAllTenants();
    }
  }, [activeTenant, role]);

  const handleAddProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    if (!formName || !formPrice) return alert('Por favor, preencha os campos obrigatórios.');

    try {
      const { error } = await supabase
        .from('procedures')
        .insert({
          name: formName,
          description: formDesc,
          price: Number(formPrice),
          tenant_id: activeTenant.id
        });

      if (error) throw error;
      
      fetchProcedures();
      setFormName('');
      setFormDesc('');
      setFormPrice('');
      alert('Procedimento cadastrado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao cadastrar procedimento:', err);
      alert('Erro ao cadastrar: ' + err.message);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    if (!unitName) return alert('Nome da unidade é obrigatório.');

    try {
      const { error } = await supabase
        .from('units')
        .insert({
          name: unitName,
          address: unitAddress,
          tenant_id: activeTenant.id
        });

      if (error) throw error;

      fetchUnits();
      setUnitName('');
      setUnitAddress('');
      alert('Unidade de atendimento adicionada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao cadastrar unidade:', err);
      alert('Erro ao cadastrar: ' + err.message);
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ativo' ? 'inadimplente' : 'ativo';
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ status_assinatura: newStatus })
        .eq('id', tenantId);

      if (error) throw error;
      fetchAllTenants();
    } catch (err: any) {
      console.error('Erro ao alterar status da clínica:', err);
      alert('Erro: ' + err.message);
    }
  };

  const changeTenantPlan = async (tenantId: string, plan: 'Básico' | 'Pro' | 'Multi-unidade') => {
    const limits = {
      'Básico': { users: 3, units: 1 },
      'Pro': { users: 10, units: 3 },
      'Multi-unidade': { users: 30, units: 10 }
    };

    try {
      const { error } = await supabase
        .from('tenants')
        .update({ 
          plano: plan,
          limite_usuarios: limits[plan].users,
          limite_unidades: limits[plan].units
        })
        .eq('id', tenantId);

      if (error) throw error;
      fetchAllTenants();
    } catch (err: any) {
      console.error('Erro ao alterar plano da clínica:', err);
      alert('Erro: ' + err.message);
    }
  };

  if (role === 'super_admin') {
    return (
      <div className={styles.container}>
        <div className={styles.titleSection}>
          <div>
            <h1 className={styles.title}>Painel Super Admin SaaS</h1>
            <p className={styles.subtitle}>Gerenciamento global de clínicas assinantes, planos e adimplência da plataforma.</p>
          </div>
        </div>

        <div className={styles.card} style={{ width: '100%', maxWidth: 'none', marginTop: '24px' }}>
          <h2 className={styles.cardTitle}>
            <Users size={20} style={{ color: 'hsl(var(--primary))' }} />
            Clínicas Registradas ({tenants.length})
          </h2>

          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px', color: 'hsl(var(--text-muted))' }}>
                  <th style={{ padding: '12px' }}>Nome da Clínica</th>
                  <th style={{ padding: '12px' }}>Plano</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Limites (Users / Unids)</th>
                  <th style={{ padding: '12px' }}>Data Início</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid hsl(var(--border-color))' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{t.nome_clinica}</td>
                    <td style={{ padding: '12px' }}>
                      <select 
                        value={t.plano} 
                        onChange={(e) => changeTenantPlan(t.id, e.target.value as any)}
                        style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', color: 'white' }}
                      >
                        <option value="Básico">Básico</option>
                        <option value="Pro">Pro</option>
                        <option value="Multi-unidade">Multi-unidade</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: t.status_assinatura === 'ativo' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: t.status_assinatura === 'ativo' ? '#10b981' : '#ef4444'
                      }}>
                        {t.status_assinatura.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{t.limite_usuarios} usuários / {t.limite_unidades} unids</td>
                    <td style={{ padding: '12px' }}>{new Date(t.data_inicio).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        onClick={() => toggleTenantStatus(t.id, t.status_assinatura)}
                        style={{
                          background: t.status_assinatura === 'ativo' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          color: t.status_assinatura === 'ativo' ? '#ef4444' : '#10b981',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {t.status_assinatura === 'ativo' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        <span>{t.status_assinatura === 'ativo' ? 'Suspender' : 'Ativar'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <div>
          <h1 className={styles.title}>Administração do Sistema</h1>
          <p className={styles.subtitle}>Gerencie unidades da clínica, procedimentos odontológicos e configurações gerais.</p>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Marca e Logomarca da Clínica */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Image size={20} style={{ color: 'hsl(var(--primary))' }} />
            Logomarca e Identidade Visual
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '13px', lineHeight: '1.5' }}>
            Envie a logomarca da sua clínica para personalizar a barra lateral de navegação e as comunicações com os pacientes.
          </p>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px', 
            background: 'rgba(255, 255, 255, 0.02)', 
            padding: '20px', 
            borderRadius: '12px', 
            border: '1px solid hsl(var(--border-color))',
            marginTop: '8px'
          }}>
            {activeTenant?.logo_url ? (
              <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                <img 
                  src={activeTenant.logo_url} 
                  alt="Logo da Clínica" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    borderRadius: '12px',
                    border: '2px solid hsl(var(--primary))'
                  }} 
                />
              </div>
            ) : (
              <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '28px',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                flexShrink: 0
              }}>
                {activeTenant ? activeTenant.nome_clinica.substring(0, 2).toUpperCase() : 'OM'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'hsl(var(--text-main))' }}>
                {activeTenant ? activeTenant.nome_clinica : 'Minha Clínica'}
              </span>
              <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>
                Formatos aceitos: PNG, JPG ou SVG. Limite de 2MB.
              </span>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'hsl(var(--primary))',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s',
                  opacity: uploading ? 0.7 : 1
                }}>
                  <Upload size={14} />
                  <span>{uploading ? 'Enviando...' : 'Carregar Nova Logo'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoUpload} 
                    disabled={uploading}
                    style={{ display: 'none' }} 
                  />
                </label>

                {activeTenant?.logo_url && (
                  <button
                    onClick={handleLogoRemove}
                    disabled={uploading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    <Trash2 size={14} />
                    <span>Remover</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Unidades da Clínica */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Building size={20} style={{ color: 'hsl(var(--primary))' }} />
            Unidades de Atendimento
          </h2>
          <div className={styles.list}>
            {units.map(unit => (
              <div key={unit.id} className={styles.listItem}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{unit.name}</span>
                  <span className={styles.itemDesc}>{unit.address}</span>
                </div>
              </div>
            ))}
          </div>

          <form className={styles.form} onSubmit={handleAddUnit} style={{ marginTop: '24px', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Adicionar Nova Unidade</h3>
            
            <div className={styles.formGroup}>
              <label>Nome da Unidade</label>
              <input 
                type="text" 
                className={styles.input} 
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Ex: OdontoManager - Filial Lapa"
                required 
              />
            </div>

            <div className={styles.formGroup}>
              <label>Endereço Completo</label>
              <input 
                type="text" 
                className={styles.input} 
                value={unitAddress}
                onChange={(e) => setUnitAddress(e.target.value)}
                placeholder="Ex: Rua Guaicurus, 120 - São Paulo, SP"
                required
              />
            </div>

            <button type="submit" className={styles.actionBtn}>
              <Plus size={16} />
              <span>Adicionar Unidade</span>
            </button>
          </form>
        </div>

        {/* Procedimentos Cadastrados & Novo Procedimento */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <ShieldCheck size={20} style={{ color: 'hsl(var(--success))' }} />
            Procedimentos e Tabela de Preços
          </h2>
          
          <div className={styles.list} style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {procedures.length > 0 ? (
              procedures.map(proc => (
                <div key={proc.id} className={styles.listItem}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{proc.name}</span>
                    <span className={styles.itemDesc}>{proc.description || 'Sem descrição'}</span>
                  </div>
                  <span className={styles.itemValue}>R$ {proc.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '13px' }}>Nenhum procedimento cadastrado.</p>
            )}
          </div>

          <form className={styles.form} onSubmit={handleAddProcedure}>
            <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Cadastrar Novo Procedimento</h3>
            
            <div className={styles.formGroup}>
              <label>Nome do Procedimento</label>
              <input 
                type="text" 
                className={styles.input} 
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Ortodontia Manutenção"
                required 
              />
            </div>

            <div className={styles.formGroup}>
              <label>Descrição</label>
              <input 
                type="text" 
                className={styles.input} 
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Ex: Manutenção mensal do aparelho metálico"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Preço Base (R$)</label>
              <input 
                type="number" 
                className={styles.input} 
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00"
                required 
              />
            </div>

            <button type="submit" className={styles.actionBtn}>
              <Plus size={16} />
              <span>Adicionar Procedimento</span>
            </button>
          </form>
        </div>

        {/* Gestão da Equipe & Convites */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Users size={20} style={{ color: 'hsl(var(--primary))' }} />
            Membros da Equipe ({staff.length})
          </h2>
          
          <div className={styles.list} style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {staff.length > 0 ? (
              staff.map(member => (
                <div key={member.id} className={styles.listItem}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{member.name}</span>
                    <span className={styles.itemDesc}>
                      {member.email} | {member.role === 'admin' ? 'Administrador' : member.role === 'dentist' ? 'Dentista' : member.role === 'receptionist' ? 'Recepção' : member.role === 'finance' ? 'Financeiro' : member.role}
                    </span>
                  </div>
                  {member.role !== 'admin' && (
                    <button 
                      onClick={() => handleRemoveStaff(member.id)}
                      className={styles.removeBtn}
                      title="Remover membro"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '13px', padding: '12px' }}>Nenhum membro cadastrado.</p>
            )}
          </div>

          <div style={{ marginTop: '12px', borderTop: '1px dashed hsl(var(--border-color))', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Convidar Novo Profissional</h3>
            
            <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: '6px', display: 'block' }}>Função do Convidado</label>
              <select 
                value={inviteRole} 
                onChange={(e) => {
                  setInviteRole(e.target.value as any);
                  setInviteLink('');
                }}
                className={styles.input}
                style={{ background: 'hsl(var(--bg-app))', color: 'white', width: '100%', cursor: 'pointer' }}
              >
                <option value="dentist">Dentista</option>
                <option value="receptionist">Recepção</option>
                <option value="finance">Financeiro</option>
              </select>
            </div>

            <button 
              onClick={generateInviteLink} 
              className={styles.actionBtn}
              style={{ width: '100%', marginBottom: '12px' }}
            >
              Gerar Link de Convite
            </button>

            {inviteLink && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', wordBreak: 'break-all', lineHeight: '1.4' }}>{inviteLink}</span>
                <button 
                  onClick={copyInviteLink}
                  style={{
                    background: copiedLink ? 'hsl(var(--success))' : 'rgba(20, 184, 166, 0.1)',
                    color: copiedLink ? 'white' : '#14b8a6',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
