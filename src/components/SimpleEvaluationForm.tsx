import React, { useState, useRef, useEffect } from 'react';
import type { SimpleSensorialSample } from '../types';
import { EMPANADAS_GUSTOS } from '../types';
import { supabase } from '../lib/supabase';
import { toPostgresDate, notifySyncChange } from '../lib/syncService';
import {
  Calendar,
  Clock,
  User,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Send,
  PenTool,
  Eye,
  Wind,
  Smile,
  Award,
  Info,
  Lock,
  ChevronDown,
  Check
} from 'lucide-react';

interface SimpleEvaluationFormProps {
  onSavedSuccess?: () => void;
  onOpenAdmin?: () => void;
}

const createEmptySample = (gusto = '', codigoMuestra = ''): SimpleSensorialSample => ({
  gusto,
  codigoMuestra,
  v1_color: '',
  v2_cantidad_mezclado: '',
  v3_ingredientes: '',
  v4_sellado: '',
  v5_caramelizacion: '',
  o1_aroma: '',
  b1_primer_mordisco: '',
  b2_textura: '',
  b3_sal_dulce_picante: '',
  b4_sabor: '',
  b5_sabor_post_tragar: '',
  g1_diferencias_estandar: '',
  g2_general_mejoras: '',
  g3_aprobacion: '',
});

// Componente TextArea auto-expansible sin agarradera de redimensionar
const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  className?: string;
  minHeight?: number;
}> = ({ value, onChange, placeholder, className = '', minHeight = 52 }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, minHeight)}px`;
    }
  }, [value, minHeight]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.max(e.target.scrollHeight, minHeight)}px`;
      }}
      placeholder={placeholder}
      className={`w-full resize-none overflow-hidden transition-all text-base sm:text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 ${className}`}
    />
  );
};

export const SimpleEvaluationForm: React.FC<SimpleEvaluationFormProps> = ({ onSavedSuccess }) => {
  // Encabezado
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultFecha = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const defaultHora = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const [fecha, setFecha] = useState(defaultFecha);
  const [hora, setHora] = useState(defaultHora);
  const [evaluador, setEvaluador] = useState(localStorage.getItem('mg_sensorial_simple_evaluador') || '');
  const [loteBatea, setLoteBatea] = useState('');

  // Columnas de Muestras (por defecto 1 muestra, el usuario puede agregar hasta 5)
  const [muestras, setMuestras] = useState<SimpleSensorialSample[]>([
    createEmptySample(),
  ]);

  // Pestaña activa de muestra (Gusto 1, Gusto 2...)
  const [activeMobileSampleIndex, setActiveMobileSampleIndex] = useState(0);
  const [isGustoDropdownOpen, setIsGustoDropdownOpen] = useState(false);

  // Modal / Canvas Firma
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [firmaData, setFirmaData] = useState<string>('');
  const [hasDrawn, setHasDrawn] = useState(false);

  // Estados de guardado / feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guardar nombre de evaluador frecuente
  useEffect(() => {
    if (evaluador.trim()) {
      localStorage.setItem('mg_sensorial_simple_evaluador', evaluador.trim());
    }
  }, [evaluador]);

  // Manejo de canvas de firma
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
  }, []);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCanvasCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setFirmaData(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaData('');
    setHasDrawn(false);
  };

  // Modificar muestra
  const handleUpdateSample = (index: number, field: keyof SimpleSensorialSample, value: string) => {
    setMuestras(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddSample = () => {
    if (muestras.length >= 5) return;
    setMuestras(prev => [...prev, createEmptySample()]);
    setActiveMobileSampleIndex(muestras.length);
  };

  const handleRemoveSample = (index: number) => {
    if (muestras.length <= 1) return;
    setMuestras(prev => prev.filter((_, i) => i !== index));
    if (activeMobileSampleIndex >= index && activeMobileSampleIndex > 0) {
      setActiveMobileSampleIndex(prev => prev - 1);
    }
  };

  const resetForm = () => {
    const newNow = new Date();
    setFecha(`${pad(newNow.getDate())}/${pad(newNow.getMonth() + 1)}/${newNow.getFullYear()}`);
    setHora(`${pad(newNow.getHours())}:${pad(newNow.getMinutes())}`);
    setLoteBatea('');
    setMuestras([createEmptySample()]);
    setActiveMobileSampleIndex(0);
    clearSignature();
    setErrorMessage(null);
    setSaveSuccess(false);
  };

  // Campos requeridos por cada muestra para considerar la evaluación terminada
  const requiredSampleFields: (keyof SimpleSensorialSample)[] = [
    'gusto',
    'v1_color',
    'v2_cantidad_mezclado',
    'v3_ingredientes',
    'v4_sellado',
    'v5_caramelizacion',
    'o1_aroma',
    'b1_primer_mordisco',
    'b2_textura',
    'b3_sal_dulce_picante',
    'b4_sabor',
    'b5_sabor_post_tragar',
    'g1_diferencias_estandar',
    'g2_general_mejoras',
    'g3_aprobacion',
  ];

  // Comprobar muestras y puntos pendientes
  const pendingEvaluationInfo = React.useMemo(() => {
    const issues: { sampleIndex: number; gustoName: string; missingCount: number }[] = [];
    
    muestras.forEach((m, idx) => {
      const missing = requiredSampleFields.filter(f => !m[f] || !String(m[f]).trim());
      if (missing.length > 0) {
        issues.push({
          sampleIndex: idx,
          gustoName: m.gusto ? m.gusto : `Gusto ${idx + 1}`,
          missingCount: missing.length,
        });
      }
    });

    const isComplete = issues.length === 0;
    return { isComplete, issues };
  }, [muestras]);

  // Guardar en base de datos
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validación mínima
    if (!evaluador.trim()) {
      setErrorMessage('Por favor ingresá el nombre del Evaluador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!loteBatea.trim()) {
      setErrorMessage('Por favor indicá el Lote o Batea.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const gustosCargados = muestras.filter(m => m.gusto.trim() !== '');
    if (gustosCargados.length === 0) {
      setErrorMessage('Por favor seleccioná o escribí al menos un Gusto en las muestras.');
      window.scrollTo({ top: 200, behavior: 'smooth' });
      return;
    }

    setIsSaving(true);

    try {
      // Guardar cada muestra cargada en sensorial_evaluations_v2
      const inserts = gustosCargados.map(m => ({
        fecha: toPostgresDate(fecha),
        hora,
        evaluador: evaluador.trim(),
        lote_batea: loteBatea.trim(),
        gusto: m.gusto,
        codigo_muestra: m.codigoMuestra || 'INF-D003-V3',
        v1_color: m.v1_color || 'Simple',
        v2_cantidad: 'Justo',
        v3_mezclado: 'Parejo',
        v4_ingredientes_receta: 'Sí',
        v5_ingrediente_extrano: 'No',
        v6_sellado_carne: 'Dorada y jugosa',
        v7_rehogado_vegetales: 'Justo',
        v8_caramelizacion: 'Justa',
        obs_vista: `[V1 Color]: ${m.v1_color}\n[V2 Relleno/Mezclado]: ${m.v2_cantidad_mezclado}\n[V3 Ingredientes]: ${m.v3_ingredientes}\n[V4 Sellado]: ${m.v4_sellado}\n[V5 Caramelización]: ${m.v5_caramelizacion}`.trim(),
        o1_intensidad_aroma: 'Justa',
        o2_aroma_caracteristico: 'Sí',
        o3_olor_extrano: ['No'],
        obs_olfato: `[O1 Aroma]: ${m.o1_aroma}`.trim(),
        b1_primer_impacto: ['Masa'],
        b2_textura_masa: 'Tierna',
        b3_jugosidad_relleno: 'Jugoso',
        b4_textura_carne: 'Tierna',
        b5_sal: 'Justa',
        b6_dulce: 'Justo',
        b7_picante: 'Justo',
        b8_sabor_caracteristico: 'Justo',
        b9_ingrediente_tapa: 'No',
        b10_sabor_extrano: ['No'],
        b11_retrogusto: 'Agradable',
        obs_boca: `[B1 Primer mordisco]: ${m.b1_primer_mordisco}\n[B2 Textura]: ${m.b2_textura}\n[B3 Sal/Dulce/Picante]: ${m.b3_sal_dulce_picante}\n[B4 Sabor]: ${m.b4_sabor}\n[B5 Retrogusto]: ${m.b5_sabor_post_tragar}`.trim(),
        g1_estandar_gusto: 'Igual',
        g2_gusto_general: 5,
        g3_aprobacion: m.g3_aprobacion.toLowerCase().includes('no') ? 'No' : 'Sí',
        obs_global: `[G1 Diferencias estándar]: ${m.g1_diferencias_estandar}\n[G2 General y mejoras]: ${m.g2_general_mejoras}\n[G3 Aprobación / Por qué]: ${m.g3_aprobacion}\n[FORMATO]: Cuestionario Simple INF-D003 V3`.trim(),
        firma_evaluador: firmaData || evaluador.trim(),
        fotos: [],
        saved_by_email: localStorage.getItem('mg_sensorial_admin_user') || 'control_calidad@migusto.com.ar'
      }));

      const { error } = await supabase
        .from('sensorial_evaluations_v2')
        .insert(inserts);

      if (error) {
        console.warn('Error al guardar en Supabase, guardando copia local pendiente:', error);
      }

      // Guardar también copia local en localStorage
      const localKey = 'mg_sensorial_evaluaciones_simple';
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
      const newSheetRecord = {
        id: `simple_${Date.now()}`,
        fecha,
        hora,
        evaluador,
        loteBatea,
        codigoForm: 'INF-D003',
        version: '3',
        vigencia: '2026',
        muestras: gustosCargados,
        firmaEvaluador: firmaData,
        synced: !error,
        created_at: new Date().toISOString()
      };
      existing.unshift(newSheetRecord);
      localStorage.setItem(localKey, JSON.stringify(existing.slice(0, 50)));
      notifySyncChange();

      setSaveSuccess(true);
      if (onSavedSuccess) onSavedSuccess();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al guardar la evaluación.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentSample = muestras[activeMobileSampleIndex] || muestras[0];

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-3 sm:py-8 min-h-screen overflow-y-visible flex-1 flex flex-col justify-between text-[#2c2724]">
      {/* Alerta de Éxito */}
      {saveSuccess && (
        <div className="mb-4 sm:mb-6 p-4 sm:p-6 bg-emerald-50 border-2 border-emerald-500 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-bounce-short">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-emerald-900 leading-tight">
                ¡Evaluación Enviada con Éxito!
              </h3>
              <p className="text-xs sm:text-sm text-emerald-700 font-medium mt-0.5">
                Cuestionario de Evaluación Sensorial registrado correctamente en el sistema.
              </p>
            </div>
          </div>
          <button
            onClick={resetForm}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Nueva Evaluación
          </button>
        </div>
      )}

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-rose-50 border-l-4 border-rose-500 rounded-xl shadow-md flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-xs sm:text-sm font-bold text-rose-800">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ENCABEZADO OFICIAL DE LA PLANILLA (Código INF-D003) */}
        <div className="bg-white rounded-2xl border border-[#ded4c3] shadow-md overflow-hidden">
          {/* Fila superior: Título Principal | Metadatos */}
          <div className="grid grid-cols-1 md:grid-cols-12 border-b border-[#ded4c3] divide-y md:divide-y-0 md:divide-x divide-[#ded4c3] bg-white">
            <div className="md:col-span-9 p-3 sm:p-4 flex flex-col items-center justify-center text-center bg-white">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] sm:text-xs uppercase font-bold tracking-widest text-slate-500">
                  Auditoría de Calidad en Planta
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-[#5969E6] text-white shadow-sm">
                  INF-D003 V3
                </span>
              </div>
              <h1 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 leading-tight">
                CUESTIONARIO DE EVALUACIÓN SENSORIAL
              </h1>
            </div>

            <div className="hidden md:flex md:col-span-3 p-3 text-right flex-col justify-center text-xs font-bold text-slate-700 bg-slate-50">
              <div className="flex justify-between md:justify-end gap-2">
                <span className="text-slate-500 uppercase text-[10px]">CÓDIGO:</span>
                <span className="font-mono font-black text-slate-900">INF-D003</span>
              </div>
              <div className="flex justify-between md:justify-end gap-2">
                <span className="text-slate-500 uppercase text-[10px]">VERSIÓN:</span>
                <span className="font-mono font-black text-slate-900">3</span>
              </div>
              <div className="flex justify-between md:justify-end gap-2">
                <span className="text-slate-500 uppercase text-[10px]">VIGENCIA:</span>
                <span className="font-mono font-black text-slate-900">___/___/2026</span>
              </div>
            </div>
          </div>

          {/* Fila de Datos: Fecha y Hora en una misma línea en mobile, 4 columnas en desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 bg-white">
            <div className="p-2.5 sm:p-3.5 border-r border-[#ded4c3]">
              <label className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#5969E6]" />
                FECHA:
              </label>
              <input
                type="text"
                placeholder="dd/mm/aaaa"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 focus:bg-white focus:border-[#5969E6] focus:ring-1 focus:ring-[#5969E6] outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                required
              />
            </div>

            <div className="p-2.5 sm:p-3.5 md:border-r border-[#ded4c3]">
              <label className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#5969E6]" />
                HORA (24 HS):
              </label>
              <input
                type="text"
                placeholder="hh:mm (ej: 14:30)"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 focus:bg-white focus:border-[#5969E6] focus:ring-1 focus:ring-[#5969E6] outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                required
              />
            </div>

            <div className="p-2.5 sm:p-3.5 col-span-2 md:col-span-1 border-t md:border-t-0 md:border-r border-[#ded4c3]">
              <label className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5">
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#5969E6]" />
                <span>EVALUADOR:</span>
                <span className="text-[#eb5757] font-extrabold text-sm ml-0.5" title="Campo obligatorio">*</span>
              </label>
              <input
                type="text"
                placeholder="Tu nombre y apellido"
                value={evaluador}
                onChange={(e) => setEvaluador(e.target.value)}
                className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 focus:bg-white focus:border-[#5969E6] focus:ring-1 focus:ring-[#5969E6] outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                required
              />
            </div>

            <div className="p-2.5 sm:p-3.5 col-span-2 md:col-span-1 border-t md:border-t-0 border-[#ded4c3]">
              <label className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 mb-1 sm:mb-1.5">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#5969E6]" />
                <span>LOTE / BATEA:</span>
                <span className="text-[#eb5757] font-extrabold text-sm ml-0.5" title="Campo obligatorio">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: LOTE-402 B1"
                value={loteBatea}
                onChange={(e) => setLoteBatea(e.target.value)}
                className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 focus:bg-white focus:border-[#5969E6] focus:ring-1 focus:ring-[#5969E6] outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                required
              />
            </div>
          </div>

          {/* Instrucciones de la Planilla */}
          <div className="p-3 sm:p-3.5 bg-amber-50/70 border-t border-[#ded4c3] text-xs sm:text-sm text-slate-800 leading-relaxed italic flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Escribí con tus palabras qué te pareció cada aspecto. Evaluá en orden: <strong>vista, olfato y boca</strong>. Del gusto más suave al más intenso. Entre gustos: <em>agua y galleta sin sal</em>.
            </span>
          </div>
        </div>

        {/* PANEL FUSIONADO: MUESTRAS A EVALUAR Y CÓDIGO (EN EL MISMO CONTENEDOR Y EN LA MISMA LÍNEA) */}
        <div className="bg-white rounded-2xl border border-[#ded4c3] shadow-md relative z-30 p-2.5 sm:p-3.5 space-y-2">
          {/* Título centrado, sutil y pequeño */}
          <div className="text-center">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600">
              Muestras a evaluar
            </span>
          </div>

          {/* Botones de Gusto sutiles uno al lado del otro + botón + */}
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {muestras.map((m, idx) => {
              const isSelected = activeMobileSampleIndex === idx;
              const hasGustoAssigned = Boolean(m.gusto && m.gusto.trim() !== '');

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveMobileSampleIndex(idx);
                    setIsGustoDropdownOpen(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : hasGustoAssigned
                      ? 'bg-white text-slate-800 border-[#ded4c3] font-bold shadow-xs'
                      : 'bg-white/70 text-slate-500 border-[#ded4c3] hover:bg-white'
                  }`}
                >
                  <span>{m.gusto ? m.gusto : `Gusto ${idx + 1}`}</span>
                  {muestras.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSample(idx);
                        setIsGustoDropdownOpen(false);
                      }}
                      className={`p-0.5 rounded hover:bg-black/20 ${isSelected ? 'text-white' : 'text-slate-400 hover:text-rose-600'}`}
                      title="Eliminar muestra"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}

            {muestras.length < 5 && (
              <button
                type="button"
                onClick={() => {
                  handleAddSample();
                  setIsGustoDropdownOpen(false);
                }}
                className="w-7 h-7 rounded-lg bg-[#5969E6] hover:bg-[#4856c4] text-white flex items-center justify-center shadow-sm transition-all shrink-0 active:scale-95"
                title="Añadir hasta 5 muestras"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Fila en la misma línea: Desplegable de Gusto y Código de Muestra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 pt-2 border-t border-[#ded4c3] items-center">
            {/* Campo 1: Selector Estilizado de Gusto */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 shrink-0 flex items-center">
                <span>Gusto {activeMobileSampleIndex + 1}:</span>
                <span className="text-[#eb5757] font-extrabold text-sm ml-0.5" title="Campo obligatorio">*</span>
              </label>
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setIsGustoDropdownOpen((prev) => !prev)}
                  className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-white border border-[#ded4c3] rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#5969E6] shadow-xs flex items-center justify-between transition-all hover:border-[#5969E6] h-[38px]"
                >
                  <span className={`truncate text-left flex-1 ${currentSample.gusto ? 'text-slate-900 font-bold' : 'text-slate-400 font-normal'}`}>
                    {currentSample.gusto || 'Seleccionar Gusto...'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#5969E6] transition-transform duration-200 shrink-0 ml-1.5 ${
                      isGustoDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isGustoDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsGustoDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#fdfbf7] border border-[#ded4c3] rounded-xl shadow-2xl p-1.5 max-h-64 flex flex-col animate-fade-in min-w-[220px]">
                      <div className="overflow-y-auto space-y-0.5 flex-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {EMPANADAS_GUSTOS.map((g) => {
                          const isSelected = currentSample.gusto === g;
                          return (
                            <button
                              type="button"
                              key={g}
                              onClick={() => {
                                handleUpdateSample(activeMobileSampleIndex, 'gusto', g);
                                setIsGustoDropdownOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-between ${
                                isSelected
                                  ? 'bg-[#5969E6] text-white font-bold'
                                  : 'text-[#2c2724] hover:bg-[#eeedfc] hover:text-[#5969E6]'
                              }`}
                            >
                              <span className="truncate">{g}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Campo 2: Código de Muestra */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 shrink-0">
                Código de muestra:
              </label>
              <input
                type="text"
                placeholder={`Ej: M-${activeMobileSampleIndex + 1} (Horno 2 / Batea 3)`}
                value={currentSample.codigoMuestra}
                onChange={(e) => handleUpdateSample(activeMobileSampleIndex, 'codigoMuestra', e.target.value)}
                className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-white border border-[#ded4c3] rounded-lg px-2.5 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-[#5969E6] focus:border-[#5969E6] placeholder:text-slate-400 placeholder:font-normal shadow-xs h-[38px]"
              />
            </div>
          </div>
        </div>

        {/* CONTENEDOR DE EVALUACIÓN VERTICAL EN TARJETAS (100% MÓVIL Y FLUIDO) */}
        <div className="space-y-4">

          {/* SECCIÓN 1: VISTA */}
          <div className="bg-white rounded-2xl border border-[#ded4c3] shadow-sm overflow-hidden">
            <div className="bg-blue-50/60 px-3.5 py-2.5 border-b border-[#ded4c3] flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-700 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black uppercase text-blue-950 tracking-wider">
                1. VISTA – empanada cortada al medio
              </h2>
            </div>

            <div className="p-3.5 space-y-4 divide-y divide-slate-100">
              {/* V1 */}
              <div>
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">V1</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te pareció el color del relleno?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">¿Es el esperado para el gusto? ¿Más claro, más oscuro?</p>
                <AutoResizeTextarea
                  value={currentSample.v1_color}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'v1_color', val)}
                  placeholder="Detallá el tono del relleno, brillo o si está más pálido/oscuro..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* V2 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">V2</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te pareció la cantidad de relleno y el mezclado?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">¿Poco, justo o mucho relleno? ¿Ingredientes repartidos parejo?</p>
                <AutoResizeTextarea
                  value={currentSample.v2_cantidad_mezclado}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'v2_cantidad_mezclado', val)}
                  placeholder="Comentá si la cantidad es abundante o escasa, y si el ligado es homogéneo..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* V3 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">V3</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te parecieron los ingredientes?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">¿Están todos los de la receta? ¿Falta o sobra alguno? ¿Hay alguno que no corresponde?</p>
                <AutoResizeTextarea
                  value={currentSample.v3_ingredientes}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'v3_ingredientes', val)}
                  placeholder="Indicá si falta algún ingrediente clave o si se observa algo fuera de ficha técnica..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* V4 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">V4</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te pareció el sellado de la carne y los vegetales?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">Carne dorada y jugosa, gris o seca. Vegetales crudos, justos o quemados.</p>
                <AutoResizeTextarea
                  value={currentSample.v4_sellado}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'v4_sellado', val)}
                  placeholder="Evaluá punto de cocción de la carne y rehogado de verduras..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* V5 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">V5</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te pareció la caramelización?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">Solo si la receta la lleva. ¿Poca, justa, excesiva o amarga?</p>
                <AutoResizeTextarea
                  value={currentSample.v5_caramelizacion}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'v5_caramelizacion', val)}
                  placeholder="Si aplica al gusto: tono acaramelado, sabor a azúcar quemada o dorada..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: OLFATO */}
          <div className="bg-white rounded-2xl border border-[#ded4c3] shadow-sm overflow-hidden">
            <div className="bg-indigo-50/60 px-3.5 py-2.5 border-b border-[#ded4c3] flex items-center gap-2">
              <Wind className="w-4 h-4 text-indigo-700 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black uppercase text-indigo-950 tracking-wider">
                2. OLFATO – relleno recién cortado
              </h2>
            </div>

            <div className="p-3.5 space-y-3.5">
              <div>
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">O1</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te pareció el aroma?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">Intensidad. ¿Se reconoce el gusto? ¿Algún olor extraño (quemado, rancio, aceite viejo)?</p>
                <AutoResizeTextarea
                  value={currentSample.o1_aroma}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'o1_aroma', val)}
                  placeholder="Describí la potencia aromática, notas especiadas o si percibís algún olor anómalo..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: BOCA */}
          <div className="bg-white rounded-2xl border border-[#ded4c3] shadow-sm overflow-hidden">
            <div className="bg-amber-50/60 px-3.5 py-2.5 border-b border-[#ded4c3] flex items-center gap-2">
              <Smile className="w-4 h-4 text-amber-700 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black uppercase text-amber-950 tracking-wider">
                3. BOCA – masa y relleno juntos
              </h2>
            </div>

            <div className="p-3.5 space-y-4 divide-y divide-slate-100">
              {/* B1 */}
              <div>
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">B1</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué fue lo primero que sentiste al morder?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">Lo primero que aparece: un ingrediente, una especia, sal, picante, grasa...</p>
                <AutoResizeTextarea
                  value={currentSample.b1_primer_mordisco}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'b1_primer_mordisco', val)}
                  placeholder="Primer impacto en boca (ej: toque de queso, masa crocante, golpe de pimienta)..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              {/* B2 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">B2</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te pareció la textura?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">Masa (cruda, tierna, crocante, dura). Relleno jugoso o seco. Carne tierna o dura.</p>
                <AutoResizeTextarea
                  value={currentSample.b2_textura}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'b2_textura', val)}
                  placeholder="Comentá la mordida de la masa y consistencia del relleno al masticar..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              {/* B3 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">B3</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Cómo estaba de sal, dulce y picante?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">Para cada uno: poco, justo o mucho. ¿Pica un gusto que no debería picar?</p>
                <AutoResizeTextarea
                  value={currentSample.b3_sal_dulce_picante}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'b3_sal_dulce_picante', val)}
                  placeholder="Equilibrio de condimentos: nivel de sal, dulzor o notas picantes..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              {/* B4 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">B4</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te pareció el sabor?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">¿Se reconoce el gusto? ¿Algún ingrediente tapa a los demás? ¿Algún sabor extraño?</p>
                <AutoResizeTextarea
                  value={currentSample.b4_sabor}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'b4_sabor', val)}
                  placeholder="¿Es característico del gusto? ¿Se distingue cada sabor de la receta?..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              {/* B5 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">B5</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué sabor te quedó después de tragar?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">Agradable, neutro o desagradable. ¿Cuánto dura?</p>
                <AutoResizeTextarea
                  value={currentSample.b5_sabor_post_tragar}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'b5_sabor_post_tragar', val)}
                  placeholder="Sensación remanente en paladar (retrogusto limpio, graso, agradable)..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: EVALUACIÓN GLOBAL */}
          <div className="bg-white rounded-2xl border border-[#ded4c3] shadow-sm overflow-hidden">
            <div className="bg-teal-50/60 px-3.5 py-2.5 border-b border-[#ded4c3] flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-700 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black uppercase text-teal-950 tracking-wider">
                4. EVALUACIÓN GLOBAL
              </h2>
            </div>

            <div className="p-3.5 space-y-4 divide-y divide-slate-100">
              {/* G1 */}
              <div>
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">G1</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué diferencias notaste con el estándar del gusto?
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-2 pl-7">Si no hay estándar, comparar con cómo debería ser el producto.</p>
                <AutoResizeTextarea
                  value={currentSample.g1_diferencias_estandar}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'g1_diferencias_estandar', val)}
                  placeholder="Compará contra la receta patrón o estándar de fábrica..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none"
                />
              </div>

              {/* G2 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">G2</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Qué te pareció en general? ¿Qué mejorarías?
                  </span>
                </div>
                <AutoResizeTextarea
                  value={currentSample.g2_general_mejoras}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'g2_general_mejoras', val)}
                  placeholder="Propuestas de mejora para producción o formulación..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none"
                />
              </div>

              {/* G3 */}
              <div className="pt-3.5">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">G3</span>
                  <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    ¿Lo aprobarías? ¿Por qué?
                  </span>
                </div>
                <AutoResizeTextarea
                  value={currentSample.g3_aprobacion}
                  onChange={(val) => handleUpdateSample(activeMobileSampleIndex, 'g3_aprobacion', val)}
                  placeholder="Dictamen final (Aprobado / No aprobado) y fundamentación..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* PIE DE FIRMA DEL EVALUADOR Y ENVÍO */}
        <div className={`rounded-2xl border transition-all p-3.5 sm:p-4 shadow-md ${
          pendingEvaluationInfo.isComplete
            ? 'bg-white border-[#ded4c3]'
            : 'bg-slate-50 border-[#ded4c3] relative overflow-hidden'
        }`}>
          {!pendingEvaluationInfo.isComplete && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5">
              <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-bold block text-sm text-amber-950 mb-0.5">
                  Panel bloqueado hasta completar la evaluación
                </span>
                Para desbloquear la firma y enviar, debés completar todos los puntos en cada gusto:
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pendingEvaluationInfo.issues.map((issue) => (
                    <button
                      key={issue.sampleIndex}
                      type="button"
                      onClick={() => {
                        setActiveMobileSampleIndex(issue.sampleIndex);
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold text-[11px] flex items-center gap-1 transition-all"
                    >
                      <span>{issue.gustoName}:</span>
                      <span className="underline">{issue.missingCount} pendientes</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center ${
            !pendingEvaluationInfo.isComplete ? 'opacity-40 pointer-events-none select-none' : ''
          }`}>
            <div className="md:col-span-4">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-[#5969E6]" />
                FIRMA DEL EVALUADOR:
              </label>
              <p className="text-[11px] text-slate-500 mt-1">
                Dibujá tu firma en el recuadro con el dedo para validar la evaluación.
              </p>
              {hasDrawn && (
                <button
                  type="button"
                  onClick={clearSignature}
                  className="mt-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Borrar y volver a firmar
                </button>
              )}
            </div>

            <div className="md:col-span-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="w-full sm:w-80 h-28 border-2 border-dashed border-[#ded4c3] rounded-xl bg-white relative overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={110}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-full cursor-crosshair touch-none"
                />
                {!hasDrawn && (
                  <span className="absolute pointer-events-none text-xs text-slate-400 font-semibold select-none">
                    Firmar aquí con el dedo
                  </span>
                )}
              </div>

              <div className="w-full sm:w-auto flex-1 flex flex-col items-center justify-center gap-2 pt-1 sm:pt-0">
                <button
                  type="submit"
                  disabled={!pendingEvaluationInfo.isComplete || isSaving}
                  className="w-auto py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl bg-[#5969E6] hover:bg-[#4856c4] text-white font-black text-xs sm:text-sm uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>{isSaving ? 'Enviando...' : 'Enviar Evaluación'}</span>
                </button>
                <div className="text-center text-[10px] sm:text-[11px] text-slate-400 font-medium max-w-xs">
                  Se registrará con fecha, lote y códigos de muestra en Calidad.
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Footer Sutil - Siempre al pie del viewport */}
      <footer className="mt-auto pt-8 pb-3 border-t border-[#e2d9c8] text-center">
        <p className="text-[10px] sm:text-[11px] text-[#7c746d] font-medium tracking-wide">
          © Desarrollado por el Departamento de Sistemas de Mi Gusto | Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
};
