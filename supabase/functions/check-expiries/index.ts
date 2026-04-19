import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function classifyDays(days: number): 'expiry_critical' | 'expiry_urgent' | 'expiry_warning' | null {
  if (days <= 0)  return 'expiry_critical';
  if (days <= 7)  return 'expiry_urgent';
  if (days <= 30) return 'expiry_warning';
  return null;
}

Deno.serve(async (_req) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const todayStr = today.toISOString().split('T')[0];
  const in30Str  = in30.toISOString().split('T')[0];

  // ── Personnel documents ──
  const { data: persDocs, error: persErr } = await supabase
    .from('personnel_documents')
    .select('id, doc_type_name, expiry_date, personnel(id, full_name, contractor_id)')
    .lte('expiry_date', in30Str)
    .not('expiry_date', 'is', null);

  if (persErr) console.error('persDocs error:', persErr);

  for (const doc of (persDocs || [])) {
    const exp   = new Date(doc.expiry_date!);
    const days  = Math.round((exp.getTime() - today.getTime()) / 86400000);
    const type  = classifyDays(days);
    if (!type) continue;
    const contractor_id = doc.personnel?.contractor_id;
    if (!contractor_id) continue;

    await supabase.from('notifications').upsert({
      contractor_id,
      type,
      entity_type:  'personnel_document',
      entity_id:    String(doc.id),
      entity_label: `${doc.personnel?.full_name} — ${doc.doc_type_name}`,
      days_until:   days,
      read:         false,
    }, { onConflict: 'contractor_id,entity_id,type', ignoreDuplicates: false });
  }

  // ── Equipment documents ──
  const { data: equipDocs, error: equipErr } = await supabase
    .from('documents')
    .select('id, doc_type_name, expiry_date, equipment_items(id, name, contractor_id)')
    .lte('expiry_date', in30Str)
    .not('expiry_date', 'is', null);

  if (equipErr) console.error('equipDocs error:', equipErr);

  for (const doc of (equipDocs || [])) {
    const exp   = new Date(doc.expiry_date!);
    const days  = Math.round((exp.getTime() - today.getTime()) / 86400000);
    const type  = classifyDays(days);
    if (!type) continue;
    const contractor_id = doc.equipment_items?.contractor_id;
    if (!contractor_id) continue;

    await supabase.from('notifications').upsert({
      contractor_id,
      type,
      entity_type:  'equipment_document',
      entity_id:    String(doc.id),
      entity_label: `${doc.equipment_items?.name} — ${doc.doc_type_name}`,
      days_until:   days,
      read:         false,
    }, { onConflict: 'contractor_id,entity_id,type', ignoreDuplicates: false });
  }

  // ── Clean up notifications older than 90 days ──
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 90);
  await supabase.from('notifications').delete().lt('created_at', cutoff.toISOString());

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
