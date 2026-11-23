import React, { useState, useMemo, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { MUSCLE_GROUPS_DATA } from '../data/trainerData';
import { Search, Printer, Trash2, Copy, Check, QrCode, Plus, X, Download } from 'lucide-react';

interface SearchableExercise {
    id: string;
    name: string;
    muscleKey: string;
    muscleName: string;
    equipmentName: string;
}

interface GeneratedQrCard extends SearchableExercise {
    url: string;
    qrDataUrl: string;
}

const PRODUCTION_ORIGIN = 'https://fiberfit.netlify.app';

const normalizeText = (text: string) =>
    text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const getBaseOrigin = () => {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return PRODUCTION_ORIGIN;
    }
    return origin;
};

export const QrGeneratorView: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [cards, setCards] = useState<GeneratedQrCard[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<Record<string, HTMLElement | null>>({});

    const allExercises = useMemo<SearchableExercise[]>(() => {
        const list: SearchableExercise[] = [];
        const seen = new Set<string>();

        Object.entries(MUSCLE_GROUPS_DATA).forEach(([muscleKey, muscleData]) => {
            muscleData.equipmentCategories.forEach((cat) => {
                cat.exercises.forEach((ex) => {
                    const uniqueKey = `${muscleKey}:${ex.id}`;
                    if (!seen.has(uniqueKey)) {
                        seen.add(uniqueKey);
                        list.push({
                            id: ex.id,
                            name: ex.name,
                            muscleKey,
                            muscleName: muscleData.name,
                            equipmentName: cat.name,
                        });
                    }
                });
            });
        });

        return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }, []);

    const filteredExercises = useMemo(() => {
        const q = normalizeText(query.trim());
        if (!q) return allExercises.slice(0, 12);
        return allExercises
            .filter((ex) => {
                const haystack = normalizeText(`${ex.name} ${ex.muscleName} ${ex.equipmentName}`);
                return haystack.includes(q);
            })
            .slice(0, 15);
    }, [query, allExercises]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddExercise = async (exercise: SearchableExercise) => {
        const alreadyExists = cards.some(
            (c) => c.id === exercise.id && c.muscleKey === exercise.muscleKey
        );
        if (alreadyExists) {
            setQuery('');
            setIsDropdownOpen(false);
            return;
        }

        const url = `${getBaseOrigin()}/trainer/${exercise.muscleKey}/${exercise.id}`;
        const qrDataUrl = await QRCode.toDataURL(url, {
            width: 512,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
                dark: '#0a0a0c',
                light: '#ffffff',
            },
        });

        setCards((prev) => [{ ...exercise, url, qrDataUrl }, ...prev]);
        setQuery('');
        setIsDropdownOpen(false);
    };

    const handleRemoveCard = (muscleKey: string, id: string) => {
        setCards((prev) => prev.filter((c) => !(c.muscleKey === muscleKey && c.id === id)));
    };

    const handleCopyUrl = async (card: GeneratedQrCard) => {
        try {
            await navigator.clipboard.writeText(card.url);
            setCopiedId(`${card.muscleKey}:${card.id}`);
            setTimeout(() => setCopiedId(null), 1800);
        } catch {
            window.prompt('Copiá este link:', card.url);
        }
    };

    const handleDownloadImage = async (card: GeneratedQrCard) => {
        const cardKey = `${card.muscleKey}:${card.id}`;
        const el = cardRefs.current[cardKey];
        if (!el) return;

        setDownloadingId(cardKey);
        try {
            const canvas = await html2canvas(el, {
                scale: 3,
                backgroundColor: null,
                useCORS: true,
            });
            const link = document.createElement('a');
            link.download = `fiberfit-qr-${card.id}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadAllImages = async () => {
        for (const card of cards) {
            await handleDownloadImage(card);
        }
    };

    return (
        <div className="qr-page w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 md:py-8 text-gray-100">
            <style>{`
                .qr-sign {
                    width: 10cm;
                    height: 15cm;
                    background: linear-gradient(165deg, #141417 0%, #0a0a0c 100%);
                    border: 2px solid #27272a;
                    border-radius: 20px;
                    padding: 24px 22px 22px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.55);
                    page-break-inside: avoid;
                    break-inside: avoid;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .qr-sign::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 6px;
                    background: linear-gradient(90deg, #16a34a, #22c55e, #4ade80);
                }
                .qr-sign::after {
                    content: '';
                    position: absolute;
                    top: -70px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 240px;
                    height: 160px;
                    background: radial-gradient(circle, rgba(34, 197, 94, 0.16) 0%, rgba(34, 197, 94, 0) 70%);
                    pointer-events: none;
                }
                .qr-corner {
                    position: absolute;
                    width: 18px;
                    height: 18px;
                    border-color: #22c55e;
                    border-style: solid;
                    pointer-events: none;
                }
                .qr-corner.tl { top: -5px; left: -5px; border-width: 3.5px 0 0 3.5px; border-top-left-radius: 8px; }
                .qr-corner.tr { top: -5px; right: -5px; border-width: 3.5px 3.5px 0 0; border-top-right-radius: 8px; }
                .qr-corner.bl { bottom: -5px; left: -5px; border-width: 0 0 3.5px 3.5px; border-bottom-left-radius: 8px; }
                .qr-corner.br { bottom: -5px; right: -5px; border-width: 0 3.5px 3.5px 0; border-bottom-right-radius: 8px; }

                @media print {
                    header, footer, .no-print {
                        display: none !important;
                    }
                    body, #root, main {
                        background: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .qr-page {
                        max-width: none !important;
                        padding: 0.4cm !important;
                    }
                    .qr-grid {
                        gap: 0.6cm !important;
                        justify-content: flex-start !important;
                    }
                    .qr-sign {
                        box-shadow: none !important;
                        border-color: #18181b !important;
                    }
                }
            `}</style>

            {/* Panel de control y buscador (oculto al imprimir) */}
            <div className="no-print bg-[#141416] border border-zinc-800 rounded-2xl p-5 sm:p-6 mb-8 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                    <div>
                        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-1 rounded-full mb-2">
                            <QrCode size={14} />
                            QR Estáticos · Sin Vencimiento
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Generador de Carteles QR
                        </h1>
                        <p className="text-sm text-zinc-400 mt-1">
                            Buscá cualquier ejercicio de la base ({allExercises.length} disponibles) para armar su cartelito 10 × 15 cm listo para imprimir.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {cards.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setCards([])}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-sm font-semibold transition-colors"
                            >
                                <Trash2 size={16} />
                                Limpiar ({cards.length})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDownloadAllImages}
                            disabled={cards.length === 0 || downloadingId !== null}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-white border border-zinc-700 font-bold text-sm transition-colors"
                        >
                            <Download size={16} className="text-green-400" />
                            {cards.length > 1 ? 'Descargar PNGs' : 'Descargar PNG'}
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            disabled={cards.length === 0}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-green-950 font-extrabold text-sm transition-colors shadow-lg shadow-green-500/20"
                        >
                            <Printer size={16} />
                            Imprimir / Guardar PDF
                        </button>
                    </div>
                </div>

                {/* Barra de búsqueda */}
                <div ref={searchContainerRef} className="relative">
                    <div className="relative flex items-center">
                        <Search size={18} className="absolute left-4 text-zinc-400 pointer-events-none" />
                        <input
                            type="text"
                            value={query}
                            onFocus={() => setIsDropdownOpen(true)}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setIsDropdownOpen(true);
                            }}
                            placeholder="Buscá un ejercicio (ej: Banco plano, Sentadilla, Dorsales Trasnuca, Bíceps...)"
                            className="w-full pl-11 pr-10 py-3.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-green-500 focus:outline-none text-white placeholder-zinc-500 text-sm sm:text-base transition-colors"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="absolute right-3 p-1 text-zinc-400 hover:text-white"
                                aria-label="Limpiar búsqueda"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {isDropdownOpen && (
                        <div className="absolute z-30 mt-2 w-full max-h-80 overflow-y-auto rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl divide-y divide-zinc-900">
                            {filteredExercises.length === 0 ? (
                                <div className="p-4 text-sm text-zinc-400 text-center">
                                    No se encontraron ejercicios para "{query}".
                                </div>
                            ) : (
                                filteredExercises.map((ex) => {
                                    const added = cards.some(
                                        (c) => c.id === ex.id && c.muscleKey === ex.muscleKey
                                    );
                                    return (
                                        <button
                                            key={`${ex.muscleKey}:${ex.id}`}
                                            type="button"
                                            onClick={() => handleAddExercise(ex)}
                                            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-zinc-900 transition-colors"
                                        >
                                            <div>
                                                <div className="text-sm font-bold text-white">{ex.name}</div>
                                                <div className="text-xs text-zinc-400">
                                                    {ex.muscleName} · {ex.equipmentName}
                                                </div>
                                            </div>
                                            <span
                                                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                                                    added
                                                        ? 'bg-zinc-800 text-zinc-400'
                                                        : 'bg-green-500/15 text-green-400 border border-green-500/30'
                                                }`}
                                            >
                                                {added ? (
                                                    <>
                                                        <Check size={13} /> Agregado
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus size={13} /> Crear QR
                                                    </>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Estado vacío */}
            {cards.length === 0 ? (
                <div className="no-print border border-dashed border-zinc-800 rounded-2xl p-12 text-center bg-zinc-950/50">
                    <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                        <QrCode size={28} className="text-green-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white mb-1">Todavía no agregaste ningún cartel</h2>
                    <p className="text-sm text-zinc-400 max-w-md mx-auto">
                        Usá la barra de búsqueda de arriba para elegir uno o varios ejercicios. Cada tarjeta se genera con un QR directo y permanente.
                    </p>
                </div>
            ) : (
                <div className="qr-grid flex flex-wrap justify-center gap-7">
                    {cards.map((card) => {
                        const cardKey = `${card.muscleKey}:${card.id}`;
                        const isCopied = copiedId === cardKey;

                        return (
                            <div key={cardKey} className="flex flex-col items-center gap-2.5">
                                {/* Barra rápida por tarjeta (oculta al imprimir) */}
                                <div className="no-print w-full flex items-center justify-between px-1">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadImage(card)}
                                            disabled={downloadingId === cardKey}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-green-400 hover:text-green-300 disabled:opacity-50 transition-colors"
                                        >
                                            <Download size={13} />
                                            <span>{downloadingId === cardKey ? 'Generando...' : 'Bajar PNG'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyUrl(card)}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-green-400 transition-colors"
                                            title={card.url}
                                        >
                                            {isCopied ? (
                                                <>
                                                    <Check size={13} className="text-green-400" />
                                                    <span className="text-green-400">Link copiado</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={13} />
                                                    <span>Copiar link</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveCard(card.muscleKey, card.id)}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={13} />
                                        Quitar
                                    </button>
                                </div>

                                {/* Cartelito 10 x 15 cm */}
                                <article
                                    ref={(el) => {
                                        cardRefs.current[cardKey] = el;
                                    }}
                                    className="qr-sign"
                                >
                                    {/* Brand */}
                                    <div className="flex items-center gap-2.5 z-10">
                                        <div
                                            className="w-[30px] h-[30px] rounded-lg flex items-center justify-center"
                                            style={{
                                                background: 'rgba(34, 197, 94, 0.14)',
                                                border: '1px solid rgba(34, 197, 94, 0.38)',
                                            }}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="#22c55e"
                                                strokeWidth="2.2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="m6.5 6.5 11 11" />
                                                <path d="m21 21-1-1" />
                                                <path d="m3 3 1 1" />
                                                <path d="m18 22 4-4" />
                                                <path d="m2 6 4-4" />
                                                <path d="m3 10 7-7" />
                                                <path d="m14 21 7-7" />
                                            </svg>
                                        </div>
                                        <div className="text-[20px] font-black tracking-tight text-white">
                                            Fiber<span className="text-[#22c55e]">Fit</span>
                                        </div>
                                    </div>

                                    {/* Título del ejercicio */}
                                    <div className="text-center z-10 w-full px-1">
                                        <div
                                            className="inline-block text-[11px] font-extrabold tracking-[0.14em] uppercase text-[#22c55e] px-3 py-1 rounded-full mb-2.5"
                                            style={{
                                                background: 'rgba(34, 197, 94, 0.14)',
                                                border: '1px solid rgba(34, 197, 94, 0.38)',
                                            }}
                                        >
                                            {card.muscleName}
                                        </div>
                                        <h2
                                            className="font-black uppercase text-white tracking-tight leading-[1.12]"
                                            style={{
                                                fontSize: card.name.length > 26 ? '19px' : '23px',
                                            }}
                                        >
                                            {card.name}
                                        </h2>
                                    </div>

                                    {/* QR Box */}
                                    <div
                                        className="z-10 w-[215px] h-[215px] bg-white rounded-[18px] p-3 relative flex items-center justify-center"
                                        style={{ boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.22)' }}
                                    >
                                        <span className="qr-corner tl" />
                                        <span className="qr-corner tr" />
                                        <span className="qr-corner bl" />
                                        <span className="qr-corner br" />
                                        <img
                                            src={card.qrDataUrl}
                                            alt={`QR ${card.name}`}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    {/* CTA Footer */}
                                    <div className="z-10 w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3.5 py-2.5 flex items-center justify-center gap-2.5">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="22"
                                            height="22"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="#22c55e"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <rect width="5" height="5" x="3" y="3" rx="1" />
                                            <rect width="5" height="5" x="16" y="3" rx="1" />
                                            <rect width="5" height="5" x="3" y="16" rx="1" />
                                            <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                                            <path d="M21 21v.01" />
                                            <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                                            <path d="M3 12h.01" />
                                            <path d="M12 3h.01" />
                                            <path d="M12 16v.01" />
                                            <path d="M16 12h1" />
                                            <path d="M21 12v.01" />
                                            <path d="M12 21v-1" />
                                        </svg>
                                        <div className="text-left">
                                            <div className="text-[12px] font-extrabold tracking-wider uppercase text-white">
                                                Escaneá el QR
                                            </div>
                                            <div className="text-[11px] text-[#a1a1aa]">
                                                Mirá la técnica y ejecución en la app
                                            </div>
                                        </div>
                                    </div>

                                    <div className="z-10 text-[10px] font-semibold tracking-[0.12em] uppercase text-[#52525b]">
                                        Entrená con Inteligencia
                                    </div>
                                </article>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
