import { Project, Plot, PlotStatus, PlotFacing, PlotType } from './types';

export const STATUS_COLORS = {
  available: {
    bg: "bg-green-500/15 dark:bg-green-500/25",
    border: "border-green-500 dark:border-green-400",
    badge: "bg-green-500 text-white",
    text: "text-green-800 dark:text-green-300",
    fill: "#22C55E",
    stroke: "#16a34a",
    hoverBg: "hover:bg-green-500/25 dark:hover:bg-green-500/35",
  },
  booked: {
    bg: "bg-amber-500/15 dark:bg-amber-500/25",
    border: "border-amber-500 dark:border-amber-400",
    badge: "bg-amber-500 text-white",
    text: "text-amber-800 dark:text-amber-300",
    fill: "#F59E0B",
    stroke: "#d97706",
    hoverBg: "hover:bg-amber-500/25 dark:hover:bg-amber-500/35",
  },
  sold: {
    bg: "bg-red-500/15 dark:bg-red-500/25",
    border: "border-red-500 dark:border-red-400",
    badge: "bg-red-500 text-white",
    text: "text-red-800 dark:text-red-300",
    fill: "#EF4444",
    stroke: "#dc2626",
    hoverBg: "hover:bg-red-500/25 dark:hover:bg-red-500/35",
  },
  investment: {
    bg: "bg-purple-500/15 dark:bg-purple-500/25",
    border: "border-purple-500 dark:border-purple-400",
    badge: "bg-purple-500 text-white",
    text: "text-purple-800 dark:text-purple-300",
    fill: "#8B5CF6",
    stroke: "#7c3aed",
    hoverBg: "hover:bg-purple-500/25 dark:hover:bg-purple-500/35",
  },
  "for resale": {
    bg: "bg-cyan-500/15 dark:bg-cyan-500/25",
    border: "border-cyan-500 dark:border-cyan-400",
    badge: "bg-cyan-500 text-white",
    text: "text-cyan-800 dark:text-cyan-300",
    fill: "#06B6D4",
    stroke: "#0891b2",
    hoverBg: "hover:bg-cyan-500/25 dark:hover:bg-cyan-500/35",
  },
  fallback: {
    bg: "bg-slate-500/15 dark:bg-slate-500/25",
    border: "border-slate-500 dark:border-slate-400",
    badge: "bg-slate-500 text-white",
    text: "text-slate-800 dark:text-slate-300",
    fill: "#6b7280",
    stroke: "#4b5563",
    hoverBg: "hover:bg-slate-500/25 dark:hover:bg-slate-500/35",
  }
};

export const getNormalizedStatus = (status: any): "available" | "booked" | "sold" | "investment" | "for resale" | "fallback" => {
  const s = String(status || "").trim().toLowerCase();
  if (s.includes("avail") || s.includes("free") || s.includes("open")) {
    return "available";
  }
  if (s.includes("sold")) {
    return "sold";
  }
  if (s.includes("book") || s.includes("hold")) {
    return "booked";
  }
  if (s.includes("invest") || s.includes("reserve") || s.includes("purple")) {
    return "investment";
  }
  if (s.includes("resale") || s.includes("cyan")) {
    return "for resale";
  }
  return "fallback";
};

export const getNormalizedProjectStatus = (status?: string): 'Upcoming' | 'Ongoing' | 'Completed' => {
  if (!status) return 'Ongoing';
  const s = status.trim().toLowerCase();
  if (s.includes('upcoming') || s.includes('pre-launch') || s.includes('pre launch') || s.includes('pre-launching') || s.includes('new launch')) {
    return 'Upcoming';
  }
  if (s.includes('completed') || s.includes('sold out') || s.includes('ready') || s.includes('delivered')) {
    return 'Completed';
  }
  return 'Ongoing';
};

export const getProjectMicroMarket = (location: string): string => {
  const loc = (location || '').toLowerCase();
  if (loc.includes('mhow') || loc.includes('veterinary')) {
    return 'Mhow Highway, Mhow';
  }
  if (loc.includes('pigdamber') || loc.includes('pigdambar')) {
    return 'Pigdambar, Rau';
  }
  if (loc.includes('rau') || loc.includes('piplya malhar') || loc.includes('rajput dhaba')) {
    return 'Rau, Indore';
  }
  const parts = (location || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(', ');
  }
  return location || 'Indore';
};

export const getStatusStyles = (status: any) => {
  const norm = getNormalizedStatus(status);
  return STATUS_COLORS[norm];
};

export const OFFICIAL_PLOT_COUNTS: Record<string, number> = {
  'Maa Ginni Vihar': 340,
  'Maa Ginni Vihar Extension': 195,
  'Shanti Vihar': 299,
  'Maa Ginni Park': 103,
  'Vrindavan Dream City': 165,
  'Shrinath Dream City': 93,
  'Greenwood Park': 254,
  'Redwood Platinum': 227,
  'Redwood Platinum Extension': 68,
  'Meera Govind Park': 110,
  'Meera Valley': 185,
  'Divine Park': 236
};

export const getOfficialTotalPlots = (name: string): number => {
  const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  // First pass: exact match
  for (const [key, val] of Object.entries(OFFICIAL_PLOT_COUNTS)) {
    const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (cleanName === cleanKey) {
      return val;
    }
  }
  // Second pass: partial match
  for (const [key, val] of Object.entries(OFFICIAL_PLOT_COUNTS)) {
    const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (cleanName.includes(cleanKey) || cleanKey.includes(cleanName)) {
      return val;
    }
  }
  return 100; // default fallback if not found
};

export const standardizeProjectPlots = (p: Project): Project => {
  if (!p) return p;

  // Source of truth: If the project already contains plots (loaded from Firestore, added/deleted by Admin),
  // NEVER truncate, regenerate, or replace them!
  const existingPlots = (p.plots && p.plots.length > 0) ? p.plots : (p.layout && p.layout.length > 0 ? p.layout : []);
  if (existingPlots.length > 0) {
    const availableCount = existingPlots.filter(
      plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE
    ).length;
    return {
      ...p,
      layout: existingPlots,
      plots: existingPlots,
      totalPlots: existingPlots.length,
      availablePlots: availableCount,
    };
  }

  const targetCount = getOfficialTotalPlots(p.name);

  const standardizePlotArray = (plotsArray: Plot[]): Plot[] => {
    let list = plotsArray ? [...plotsArray] : [];
    
    // If the project already contains plots (loaded from Firestore, added/deleted by Admin),
    // NEVER truncate, pad, or overwrite custom plot numbers!
    if (list.length > 0) {
      return list;
    }
    
    // Only bootstrap default empty placeholder plots if the project is brand new with zero plots
    for (let i = 1; i <= targetCount; i++) {
      list.push({
        id: (p.id * 1000) + i,
        number: `P-${String(i).padStart(3, '0')}`,
        size: 0,
        dimensions: 'Not Configured',
        facing: PlotFacing.NOT_CONFIGURED,
        status: PlotStatus.SOLD,
        type: 'Not Configured',
        price: 0,
        isMortgaged: false,
      });
    }
    return list;
  };

  const updatedLayout = standardizePlotArray(p.layout && p.layout.length > 0 ? p.layout : (p.plots || []));
  const updatedPlots = standardizePlotArray(p.plots && p.plots.length > 0 ? p.plots : (p.layout || []));

  const totalPlots = updatedPlots.length > 0 ? updatedPlots.length : (p.totalPlots !== undefined && p.totalPlots > 0 ? p.totalPlots : targetCount);
  const availablePlots = p.availablePlots !== undefined ? p.availablePlots : updatedPlots.filter(
    plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE
  ).length;

  return {
    ...p,
    layout: updatedLayout,
    plots: updatedPlots,
    totalPlots,
    availablePlots,
  };
};

const AVAILABLE_MAA_GINNI_PLOTS = new Set<number>([]);

export const applyMaaGinniViharOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isGinni = 
    normalizedName === 'maa ginni vihar' || 
    (normalizedName.includes('ginni vihar') && !normalizedName.includes('extension')) || 
    p.id === 5;

  if (!isGinni) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;

    if ((num >= 1 && num <= 36) || (num >= 62 && num <= 97)) {
      // 17×50 Plots
      width = 17;
      length = 50;
      dimensions = '17×50';
      size = 17 * 50;
      plotSizeLabel = '17 × 50';
      type = PlotType.NORMAL;
    } else if (
      (num >= 37 && num <= 61) || 
      (num >= 98 && num <= 144) || 
      (num >= 179 && num <= 216) || 
      (num >= 294 && num <= 301)
    ) {
      // 20×40 Plots
      width = 20;
      length = 40;
      dimensions = '20×40';
      size = 20 * 40;
      plotSizeLabel = '20 × 40';
      type = PlotType.NORMAL;
    } else if (
      (num >= 145 && num <= 178) || 
      (num >= 217 && num <= 293)
    ) {
      // 15×40 Plots
      width = 15;
      length = 40;
      dimensions = '15×40';
      size = 15 * 40;
      plotSizeLabel = '15 × 40';
      type = PlotType.NORMAL;
    } else if (num >= 302 && num <= 316) {
      // LIG Category: Plot 302–316 (Size: 15.9 × 29.9)
      width = 15.9;
      length = 29.9;
      dimensions = '15.9×29.9';
      size = 475.41;
      plotSizeLabel = '15.9 × 29.9';
      type = PlotType.LIG;
    } else if (num >= 317 && num <= 336) {
      // EWS Category: Plot 317–336 (Size: 13.4 × 26.3)
      width = 13.4;
      length = 26.3;
      dimensions = '13.4×26.3';
      size = 352.42;
      plotSizeLabel = '13.4 × 26.3';
      type = PlotType.EWS;
    } else if (num >= 337 && num <= 340) {
      // NA (Not Available): Plot 337–340
      width = 0;
      length = 0;
      dimensions = 'NA';
      size = 0;
      plotSizeLabel = 'NA';
      type = 'Not Configured';
    }

    const isAvailable = AVAILABLE_MAA_GINNI_PLOTS.has(num);
    const status = plot.status || PlotStatus.SOLD;

    return {
      ...plot,
      dimensions,
      size,
      width,
      length,
      plotSizeLabel,
      type,
      status,
    };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];
  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 340,
    availablePlots: availableCount,
    category: 'EWS: 20, LIG: 15, NA: 4',
    plotSizes: '17×50, 20×40, 15×40, 15.9×29.9, 13.4×26.3, NA',
    plotDimensions: '17×50, 20×40, 15×40, 15.9×29.9, 13.4×26.3, NA',
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const distributeStatuses = (
  plots: Plot[],
  counts: { available: number; sold: number; booked: number; hold: number; reserved: number }
): Plot[] => {
  if (!plots || plots.length === 0) return [];
  const total = plots.length;

  const pool: PlotStatus[] = [];
  for (let i = 0; i < counts.available; i++) pool.push(PlotStatus.AVAILABLE);
  for (let i = 0; i < counts.sold; i++) pool.push(PlotStatus.SOLD);
  for (let i = 0; i < counts.booked; i++) pool.push(PlotStatus.BOOKED);
  for (let i = 0; i < counts.hold; i++) pool.push(PlotStatus.HOLD);
  for (let i = 0; i < counts.reserved; i++) pool.push(PlotStatus.RESERVED);

  while (pool.length < total) {
    pool.push(PlotStatus.AVAILABLE);
  }

  const subPools = [
    pool.filter(s => s === PlotStatus.AVAILABLE),
    pool.filter(s => s === PlotStatus.SOLD),
    pool.filter(s => s === PlotStatus.BOOKED),
    pool.filter(s => s === PlotStatus.HOLD),
    pool.filter(s => s === PlotStatus.RESERVED),
  ];

  const interleaved: PlotStatus[] = [];
  let added = true;
  while (interleaved.length < total && added) {
    added = false;
    for (const sub of subPools) {
      if (sub.length > 0) {
        interleaved.push(sub.shift()!);
        added = true;
      }
    }
  }

  return plots.map((plot, idx) => {
    // Preserve plot status if it already exists
    if (plot.status) {
      return plot;
    }
    return {
      ...plot,
      status: interleaved[idx] || PlotStatus.SOLD,
    };
  });
};

const AVAILABLE_VRINDAVAN_PLOTS = new Set<number>([]);

export const applyVrindavanDreamCityOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isVrindavan = 
    normalizedName === 'vrindavan dream city' || 
    normalizedName.includes('vrindavan') || 
    p.id === 1;

  if (!isVrindavan) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;

    if (num >= 1 && num <= 7) {
      width = 7.62;
      length = 18.29;
      dimensions = '7.62×18.29';
      size = Math.round(7.62 * 18.29 * 100) / 100;
      plotSizeLabel = '7.62 × 18.29';
    } else if (num >= 8 && num <= 11) {
      width = 20;
      length = 40;
      dimensions = '20×40';
      size = 20 * 40;
      plotSizeLabel = '20 × 40';
    } else if (num >= 12 && num <= 15) {
      width = 20;
      length = 50;
      dimensions = '20×50';
      size = 20 * 50;
      plotSizeLabel = '20 × 50';
    } else if (num >= 16 && num <= 23) {
      width = 20;
      length = 40;
      dimensions = '20×40';
      size = 20 * 40;
      plotSizeLabel = '20 × 40';
    } else if (num >= 24 && num <= 27) {
      width = 20;
      length = 42.5;
      dimensions = '20×42.5';
      size = 20 * 42.5;
      plotSizeLabel = '20 × 42.5';
    } else if (num >= 28 && num <= 35) {
      width = 20;
      length = 42;
      dimensions = '20×42';
      size = 20 * 42;
      plotSizeLabel = '20 × 42';
    } else if (num >= 36 && num <= 39) {
      width = 20;
      length = 42.5;
      dimensions = '20×42.5';
      size = 20 * 42.5;
      plotSizeLabel = '20 × 42.5';
    } else if (num >= 40 && num <= 62) {
      width = 15;
      length = 45;
      dimensions = '15×45';
      size = 15 * 45;
      plotSizeLabel = '15 × 45';
    } else if (num >= 63 && num <= 81) {
      width = 15;
      length = 35;
      dimensions = '15×35';
      size = 15 * 35;
      plotSizeLabel = '15 × 35';
    } else if (num >= 82 && num <= 165) {
      width = 15;
      length = 45;
      dimensions = '15×45';
      size = 15 * 45;
      plotSizeLabel = '15 × 45';
    }

    const isAvail = AVAILABLE_VRINDAVAN_PLOTS.has(num);
    const status = plot.status || PlotStatus.SOLD;

    return {
      ...plot,
      dimensions,
      size,
      width,
      length,
      plotSizeLabel,
      status,
    };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];
  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 165,
    availablePlots: availableCount,
    plotSizes: '7.62×18.29, 20×40, 20×50, 20×42.5, 20×42, 15×45, 15×35',
    plotDimensions: '7.62×18.29, 20×40, 20×50, 20×42.5, 20×42, 15×45, 15×35',
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const applyShriKeshvamCorridorOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isKeshvam = 
    normalizedName === 'shree keshvam corridor' || 
    normalizedName.includes('keshvam') || 
    p.id === 17 ||
    p.id === 12;

  if (!isKeshvam) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;
    let category = plot.category;
    let specialType = plot.specialType;

    if (num >= 1 && num <= 5) {
      width = 6.10; length = 15.24; dimensions = '6.10×15.24'; size = Math.round(6.10 * 15.24 * 100) / 100; plotSizeLabel = '6.10 × 15.24'; type = PlotType.NORMAL;
    } else if ((num >= 6 && num <= 22) || (num >= 38 && num <= 44)) {
      width = 20; length = 50; dimensions = '20×50'; size = 20 * 50; plotSizeLabel = '20 × 50'; type = PlotType.NORMAL;
    } else if (num >= 23 && num <= 37) {
      width = 17; length = 50; dimensions = '17×50'; size = 17 * 50; plotSizeLabel = '17 × 50'; type = PlotType.NORMAL;
    } else if (num >= 45 && num <= 52) {
      width = 20; length = 45; dimensions = '20×45'; size = 20 * 45; plotSizeLabel = '20 × 45'; type = PlotType.NORMAL;
    } else if (num >= 53 && num <= 67) {
      width = 17; length = 45; dimensions = '17×45'; size = 17 * 45; plotSizeLabel = '17 × 45'; type = PlotType.NORMAL;
    } else if ((num >= 68 && num <= 95) || (num >= 112 && num <= 147) || (num >= 164 && num <= 191)) {
      width = 15; length = 40; dimensions = '15×40'; size = 15 * 40; plotSizeLabel = '15 × 40'; type = PlotType.NORMAL;
    } else if ((num >= 96 && num <= 111) || (num >= 148 && num <= 163) || (num >= 192 && num <= 199)) {
      width = 20; length = 40; dimensions = '20×40'; size = 20 * 40; plotSizeLabel = '20 × 40'; type = PlotType.NORMAL;
    } else if ((num >= 200 && num <= 218) || (num >= 231 && num <= 263)) {
      width = 25; length = 60; dimensions = '25×60'; size = 25 * 60; plotSizeLabel = '25 × 60'; type = PlotType.NORMAL;
    } else if (num >= 219 && num <= 230) {
      width = 25; length = 65; dimensions = '25×65'; size = 25 * 65; plotSizeLabel = '25 × 65'; type = PlotType.NORMAL;
    } else if (num >= 264 && num <= 272) {
      category = 'LIG'; dimensions = 'LIG'; plotSizeLabel = 'LIG'; type = PlotType.LIG;
    } else if (num >= 273 && num <= 296) {
      category = 'EWS'; dimensions = 'EWS'; plotSizeLabel = 'EWS'; type = PlotType.EWS;
    } else if (num >= 297 && num <= 300) {
      category = 'NA'; dimensions = 'NA'; plotSizeLabel = 'NA'; type = 'Not Configured';
    }

    return { ...plot, dimensions, size, width, length, plotSizeLabel, type, category, specialType };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];
  return { ...p, layout: updatedLayout, plots: updatedPlots };
};

const AVAILABLE_DIVINE_PARK_PLOTS = new Set<number>([]);

export const applyDivineParkOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isDivine = 
    normalizedName === 'divine park' || 
    normalizedName.includes('divine') || 
    p.id === 3;

  if (!isDivine) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;

    const isAverageOverride = 
      num === 31 || 
      num === 64 || 
      num === 65 || 
      num === 66 || 
      num === 67 || 
      num === 68 || 
      num === 70 || 
      num === 85 || 
      num === 116 || 
      num === 131 || 
      (num >= 227 && num <= 236);

    if (isAverageOverride) {
      dimensions = 'Average Size';
      plotSizeLabel = 'Average Size';
      width = 0;
      length = 0;
      size = 0;
    } else if (num >= 1 && num <= 11) {
      width = 20;
      length = 41;
      dimensions = '20×41';
      size = 20 * 41;
      plotSizeLabel = '20 × 41';
    } else if (num >= 12 && num <= 16) {
      width = 20;
      length = 48;
      dimensions = '20×48';
      size = 20 * 48;
      plotSizeLabel = '20 × 48';
    } else if (num >= 17 && num <= 31) {
      dimensions = 'Uneven Size';
      plotSizeLabel = 'Uneven Size';
      width = 0;
      length = 0;
      size = 0;
    } else if (num >= 32 && num <= 41) {
      width = 20;
      length = 40;
      dimensions = '20×40';
      size = 20 * 40;
      plotSizeLabel = '20 × 40';
    } else if (num >= 42 && num <= 63) {
      width = 20;
      length = 46;
      dimensions = '20×46';
      size = 20 * 46;
      plotSizeLabel = '20 × 46';
    } else if (num >= 64 && num <= 69) {
      dimensions = 'Uneven Size';
      plotSizeLabel = 'Uneven Size';
      width = 0;
      length = 0;
      size = 0;
    } else if (num >= 70 && num <= 131) {
      width = 16.66;
      length = 50;
      dimensions = '16.66×50';
      size = Math.round(16.66 * 50 * 100) / 100;
      plotSizeLabel = '16.66 × 50';
    } else if (num >= 132 && num <= 145) {
      width = 20;
      length = 26;
      dimensions = '20×26';
      size = 20 * 26;
      plotSizeLabel = '20 × 26';
    } else if (num >= 146 && num <= 160) {
      width = 20;
      length = 37;
      dimensions = '20×37';
      size = 20 * 37;
      plotSizeLabel = '20 × 37';
    } else if (num >= 161 && num <= 226) {
      width = 20;
      length = 45;
      dimensions = '20×45';
      size = 20 * 45;
      plotSizeLabel = '20 × 45';
    } else if (num >= 227 && num <= 236) {
      dimensions = 'Average Size';
      plotSizeLabel = 'Average Size';
      width = 0;
      length = 0;
      size = 0;
    }

    if (num === 25 || num === 30) {
      type = PlotType.LIG;
    }

    const isAvail = AVAILABLE_DIVINE_PARK_PLOTS.has(num);
    const status = plot.status || PlotStatus.SOLD;

    return {
      ...plot,
      dimensions,
      size,
      width,
      length,
      plotSizeLabel,
      type,
      status,
    };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];
  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 236,
    availablePlots: availableCount,
    plotSizes: '20×41, 20×46, 20×48, 20×40, 20×37, 20×45, 16.66×50, 20×26',
    plotDimensions: '20×41, 20×46, 20×48, 20×40, 20×37, 20×45, 16.66×50, 20×26',
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

const AVAILABLE_MAA_GINNI_EXT_PLOTS = new Set<number>([]);

export const applyMaaGinniViharExtensionOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isExtension = 
    normalizedName === 'maa ginni vihar extension' || 
    (normalizedName.includes('ginni') && normalizedName.includes('extension')) || 
    p.id === 4;

  if (!isExtension) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;

    if (num >= 1 && num <= 5) {
      width = 20;
      length = 60;
      dimensions = '20×60';
      size = 20 * 60;
      plotSizeLabel = '20 × 60';
      type = PlotType.NORMAL;
    } else if (num >= 6 && num <= 31) {
      width = 20;
      length = 55;
      dimensions = '20×55';
      size = 20 * 55;
      plotSizeLabel = '20 × 55';
      type = PlotType.NORMAL;
    } else if (num >= 32 && num <= 143) {
      width = 17;
      length = 50;
      dimensions = '17×50';
      size = 17 * 50;
      plotSizeLabel = '17 × 50';
      type = PlotType.NORMAL;
    } else if (num >= 144 && num <= 161) {
      width = 15;
      length = 35;
      dimensions = '15×35';
      size = 15 * 35;
      plotSizeLabel = '15 × 35';
      type = PlotType.NORMAL;
    } else if (num === 162) {
      width = 15;
      length = 35;
      dimensions = '15×35';
      size = 15 * 35;
      plotSizeLabel = '15 × 35';
      type = PlotType.LIG;
    } else if (num >= 163 && num <= 172) {
      width = 0;
      length = 0;
      dimensions = 'LIG';
      size = 0;
      plotSizeLabel = 'LIG';
      type = PlotType.LIG;
    } else if (num >= 173 && num <= 185) {
      width = 0;
      length = 0;
      dimensions = 'EWS';
      size = 0;
      plotSizeLabel = 'EWS';
      type = PlotType.EWS;
    }

    const isAvail = AVAILABLE_MAA_GINNI_EXT_PLOTS.has(num);
    const status = plot.status || PlotStatus.SOLD;

    return {
      ...plot,
      dimensions,
      size,
      width,
      length,
      plotSizeLabel,
      type,
      status,
    };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];
  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 195,
    availablePlots: availableCount,
    plotSizes: '20×60, 20×55, 17×50, 15×35',
    plotDimensions: '20×60, 20×55, 17×50, 15×35',
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

const AVAILABLE_MAA_GINNI_PARK_PLOTS = new Set<number>([]);

export const applyMaaGinniParkOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isPark = 
    normalizedName === 'maa ginni park' || 
    (normalizedName.includes('ginni') && normalizedName.includes('park')) || 
    p.id === 5 ||
    p.id === 10;

  if (!isPark) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;

    if (num >= 1 && num <= 23) {
      width = 20;
      length = 45;
      dimensions = '20×45';
      size = 20 * 45;
      plotSizeLabel = '20 × 45';
      type = PlotType.NORMAL;
    } else if (num >= 24 && num <= 52) {
      width = 17;
      length = 50;
      dimensions = '17×50';
      size = 17 * 50;
      plotSizeLabel = '17 × 50';
      type = PlotType.NORMAL;
    } else if (num >= 53 && num <= 60) {
      width = 20;
      length = 50;
      dimensions = '20×50';
      size = 20 * 50;
      plotSizeLabel = '20 × 50';
      type = PlotType.NORMAL;
    } else if (num >= 61 && num <= 78) {
      width = 20;
      length = 56;
      dimensions = '20×56';
      size = 20 * 56;
      plotSizeLabel = '20 × 56';
      type = PlotType.NORMAL;
    } else if (num >= 79 && num <= 82) {
      width = 0;
      length = 0;
      dimensions = 'LIG';
      size = 0;
      plotSizeLabel = 'LIG';
      type = PlotType.LIG;
    } else if (num >= 83 && num <= 88) {
      width = 0;
      length = 0;
      dimensions = 'EWS';
      size = 0;
      plotSizeLabel = 'EWS';
      type = PlotType.EWS;
    }

    const isAvail = AVAILABLE_MAA_GINNI_PARK_PLOTS.has(num);
    const status = plot.status || PlotStatus.SOLD;

    return {
      ...plot,
      dimensions,
      size,
      width,
      length,
      plotSizeLabel,
      type,
      status,
    };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];
  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 103,
    availablePlots: availableCount,
    plotSizes: '20×45, 17×50, 20×50, 20×56',
    plotDimensions: '20×45, 17×50, 20×50, 20×56',
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const applyShantiViharOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isShantiVihar = 
    normalizedName === 'shanti vihar' || 
    normalizedName.includes('shanti') || 
    p.id === 9;

  if (!isShantiVihar) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;

    if (num >= 1 && num <= 5) {
      width = 0;
      length = 0;
      dimensions = 'SR';
      size = 0;
      plotSizeLabel = 'SR';
      type = PlotType.NORMAL;
    } else if (num >= 6 && num <= 14) {
      width = 20;
      length = 55;
      dimensions = '20×55';
      size = 20 * 55;
      plotSizeLabel = '20 × 55';
      type = PlotType.NORMAL;
    } else if (num >= 15 && num <= 26) {
      width = 20;
      length = 50;
      dimensions = '20×50';
      size = 20 * 50;
      plotSizeLabel = '20 × 50';
      type = PlotType.NORMAL;
    } else if (num >= 27 && num <= 30) {
      width = 25;
      length = 40;
      dimensions = '25×40';
      size = 25 * 40;
      plotSizeLabel = '25 × 40';
      type = PlotType.NORMAL;
    } else if (num >= 31 && num <= 35) {
      width = 20;
      length = 40;
      dimensions = '20×40';
      size = 20 * 40;
      plotSizeLabel = '20 × 40';
      type = PlotType.NORMAL;
    } else if (num >= 36 && num <= 75) {
      width = 20;
      length = 50;
      dimensions = '20×50';
      size = 20 * 50;
      plotSizeLabel = '20 × 50';
      type = PlotType.NORMAL;
    } else if (num >= 76 && num <= 81) {
      width = 0;
      length = 0;
      dimensions = 'SR';
      size = 0;
      plotSizeLabel = 'SR';
      type = PlotType.NORMAL;
    } else if (num >= 82 && num <= 91) {
      width = 20;
      length = 45;
      dimensions = '20×45';
      size = 20 * 45;
      plotSizeLabel = '20 × 45';
      type = PlotType.NORMAL;
    } else if (num >= 92 && num <= 107) {
      width = 20;
      length = 50;
      dimensions = '20×50';
      size = 20 * 50;
      plotSizeLabel = '20 × 50';
      type = PlotType.NORMAL;
    } else if (num >= 108 && num <= 125) {
      width = 17;
      length = 45;
      dimensions = '17×45';
      size = 17 * 45;
      plotSizeLabel = '17 × 45';
      type = PlotType.NORMAL;
    } else if (num >= 126 && num <= 247) {
      width = 15;
      length = 45;
      dimensions = '15×45';
      size = 15 * 45;
      plotSizeLabel = '15 × 45';
      type = PlotType.NORMAL;
    } else if (num >= 248 && num <= 261) {
      width = 0;
      length = 0;
      dimensions = 'LIG';
      size = 0;
      plotSizeLabel = 'LIG';
      type = PlotType.LIG;
    } else if (num >= 262 && num <= 280) {
      width = 0;
      length = 0;
      dimensions = 'EWS';
      size = 0;
      plotSizeLabel = 'EWS';
      type = PlotType.EWS;
    } else if (num >= 281 && num <= 299) {
      width = 0;
      length = 0;
      dimensions = 'NA';
      size = 0;
      plotSizeLabel = 'NA';
      type = 'Not Configured';
    }

    return {
      ...plot,
      dimensions,
      size,
      width,
      length,
      plotSizeLabel,
      type,
    };
  };

  let updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  let updatedPlots = p.plots ? p.plots.map(mapPlot) : [];

  // Shanti Vihar: Total 299, Available 173, Sold 42, Booked 42, Hold 24, Reserved 18
  const counts = { available: 173, sold: 42, booked: 42, hold: 24, reserved: 18 };
  updatedLayout = distributeStatuses(updatedLayout, counts);
  updatedPlots = distributeStatuses(updatedPlots, counts);

  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 299,
    availablePlots: availableCount,
    plotSizes: 'SR, 20×55, 20×50, 25×40, 20×40, 20×45, 17×45, 15×45, LIG, EWS, NA',
    plotDimensions: 'SR, 20×55, 20×50, 25×40, 20×40, 20×45, 17×45, 15×45, LIG, EWS, NA',
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const applyGreenwoodParkOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isGreenwood = 
    normalizedName === 'greenwood park' || 
    normalizedName.includes('greenwood') || 
    p.id === 6;

  if (!isGreenwood) {
    return p;
  }

  let updatedLayout = p.layout || [];
  let updatedPlots = p.plots || [];

  // GreenWood Park: Total 254, Available 146, Sold 36, Booked 36, Hold 20, Reserved 16
  const counts = { available: 146, sold: 36, booked: 36, hold: 20, reserved: 16 };
  updatedLayout = distributeStatuses(updatedLayout, counts);
  updatedPlots = distributeStatuses(updatedPlots, counts);

  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 254,
    availablePlots: availableCount,
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const applyRedwoodPlatinumOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isRedwood = 
    (normalizedName.includes('redwood') && normalizedName.includes('platinum') && !normalizedName.includes('extension')) || 
    p.id === 7;

  if (!isRedwood) {
    return p;
  }

  let updatedLayout = p.layout || [];
  let updatedPlots = p.plots || [];

  // Redwood Platinum: Total 227, Available 131, Sold 32, Booked 32, Hold 18, Reserved 14
  const counts = { available: 131, sold: 32, booked: 32, hold: 18, reserved: 14 };
  updatedLayout = distributeStatuses(updatedLayout, counts);
  updatedPlots = distributeStatuses(updatedPlots, counts);

  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 227,
    availablePlots: availableCount,
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const applyRedwoodPlatinumExtensionOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isRedwoodPlatinumExt = 
    normalizedName === 'redwood platinum extension' || 
    (normalizedName.includes('redwood') && normalizedName.includes('platinum') && normalizedName.includes('extension')) || 
    p.id === 13;

  if (!isRedwoodPlatinumExt) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;

    if (num >= 1 && num <= 3) {
      width = 0;
      length = 0;
      dimensions = 'SR';
      size = 0;
      plotSizeLabel = 'SR';
      type = PlotType.NORMAL;
    } else if (num >= 4 && num <= 9) {
      width = 23;
      length = 41;
      dimensions = '23×41';
      size = 23 * 41;
      plotSizeLabel = '23 × 41';
      type = PlotType.NORMAL;
    } else if (num >= 10 && num <= 22) {
      width = 23;
      length = 52;
      dimensions = '23×52';
      size = 23 * 52;
      plotSizeLabel = '23 × 52';
      type = PlotType.NORMAL;
    } else if (num >= 23 && num <= 34) {
      width = 20;
      length = 52;
      dimensions = '20×52';
      size = 20 * 52;
      plotSizeLabel = '20 × 52';
      type = PlotType.NORMAL;
    } else if (num >= 35 && num <= 40) {
      width = 22;
      length = 55;
      dimensions = '22×55';
      size = 22 * 55;
      plotSizeLabel = '22 × 55';
      type = PlotType.NORMAL;
    } else if (num >= 41 && num <= 46) {
      width = 22;
      length = 50;
      dimensions = '22×50';
      size = 22 * 50;
      plotSizeLabel = '22 × 50';
      type = PlotType.NORMAL;
    } else if (num >= 47 && num <= 57) {
      width = 20;
      length = 50;
      dimensions = '20×50';
      size = 20 * 50;
      plotSizeLabel = '20 × 50';
      type = PlotType.NORMAL;
    } else if (num >= 58 && num <= 63) {
      width = 0;
      length = 0;
      dimensions = 'LIG';
      size = 0;
      plotSizeLabel = 'LIG';
      type = PlotType.LIG;
    } else if (num >= 64 && num <= 68) {
      width = 0;
      length = 0;
      dimensions = 'EWS';
      size = 0;
      plotSizeLabel = 'EWS';
      type = PlotType.EWS;
    }

    return {
      ...plot,
      dimensions,
      size,
      width,
      length,
      plotSizeLabel,
      type,
    };
  };

  let updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  let updatedPlots = p.plots ? p.plots.map(mapPlot) : [];

  // Redwood Platinum Extension: Total 68, Available 38, Sold 10, Booked 9, Hold 6, Reserved 5
  const counts = { available: 38, sold: 10, booked: 9, hold: 6, reserved: 5 };
  updatedLayout = distributeStatuses(updatedLayout, counts);
  updatedPlots = distributeStatuses(updatedPlots, counts);

  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 68,
    availablePlots: availableCount,
    plotSizes: 'SR, 23×41, 23×52, 20×52, 22×55, 22×50, 20×50, LIG, EWS',
    plotDimensions: 'SR, 23×41, 23×52, 20×52, 22×55, 22×50, 20×50, LIG, EWS',
    category: 'EWS: 5, LIG: 6, SR: 3',
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const applyShrinathDreamCityOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isShrinathDreamCity = 
    normalizedName === 'shrinath dream city' || 
    (normalizedName.includes('shrinath') && normalizedName.includes('dream') && normalizedName.includes('city')) || 
    p.id === 11;

  if (!isShrinathDreamCity) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;

    if (num >= 1 && num <= 6) {
      width = 6.70;
      length = 16.76;
      dimensions = '6.70×16.76';
      size = Math.round(6.70 * 16.76 * 100) / 100;
      plotSizeLabel = '6.70 × 16.76';
    } else if (num === 7) {
      width = 6.10;
      length = 9.14;
      dimensions = '6.10×9.14';
      size = Math.round(6.10 * 9.14 * 100) / 100;
      plotSizeLabel = '6.10 × 9.14';
    } else if (num === 8) {
      width = 6.10;
      length = 7.62;
      dimensions = '6.10×7.62';
      size = Math.round(6.10 * 7.62 * 100) / 100;
      plotSizeLabel = '6.10 × 7.62';
    } else if (num >= 9 && num <= 10) {
      width = 6.70;
      length = 16.76;
      dimensions = '6.70×16.76';
      size = Math.round(6.70 * 16.76 * 100) / 100;
      plotSizeLabel = '6.70 × 16.76';
    } else if (num === 11) {
      width = 6.10;
      length = 7.62;
      dimensions = '6.10×7.62';
      size = Math.round(6.10 * 7.62 * 100) / 100;
      plotSizeLabel = '6.10 × 7.62';
    } else if (num === 12) {
      width = 6.10;
      length = 9.14;
      dimensions = '6.10×9.14';
      size = Math.round(6.10 * 9.14 * 100) / 100;
      plotSizeLabel = '6.10 × 9.14';
    } else if (num >= 13 && num <= 14) {
      width = 6.10;
      length = 10.67;
      dimensions = '6.10×10.67';
      size = Math.round(6.10 * 10.67 * 100) / 100;
      plotSizeLabel = '6.10 × 10.67';
    } else if (num >= 15 && num <= 32) {
      width = 4.57;
      length = 12.19;
      dimensions = '4.57×12.19';
      size = Math.round(4.57 * 12.19 * 100) / 100;
      plotSizeLabel = '4.57 × 12.19';
    } else if (num >= 33 && num <= 93) {
      width = 4.57;
      length = 13.71;
      dimensions = '4.57×13.71';
      size = Math.round(4.57 * 13.71 * 100) / 100;
      plotSizeLabel = '4.57 × 13.71';
    }

    return {
      ...plot,
      dimensions,
      size,
      width,
      length,
      plotSizeLabel,
      type,
    };
  };

  let updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  let updatedPlots = p.plots ? p.plots.map(mapPlot) : [];

  // Shrinath Dream City: Total 93, Available 53, Sold 14, Booked 13, Hold 7, Reserved 6
  const counts = { available: 53, sold: 14, booked: 13, hold: 7, reserved: 6 };
  updatedLayout = distributeStatuses(updatedLayout, counts);
  updatedPlots = distributeStatuses(updatedPlots, counts);

  const availableCount = updatedPlots.filter(plot => plot.status === PlotStatus.AVAILABLE || plot.status === PlotStatus.RESALE).length;

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 93,
    availablePlots: availableCount,
    plotSizes: '6.70×16.76, 6.10×9.14, 6.10×7.62, 6.10×10.67, 4.57×12.19, 4.57×13.71',
    plotDimensions: '6.70×16.76, 6.10×9.14, 6.10×7.62, 6.10×10.67, 4.57×12.19, 4.57×13.71',
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const applyMeeraGovindParkOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isMeeraGovind = 
    normalizedName === 'meera govind park' || 
    (normalizedName.includes('meera') && normalizedName.includes('govind')) || 
    p.id === 14;

  if (!isMeeraGovind) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;
    let category = plot.category;
    let specialType = plot.specialType;

    if ((num >= 1 && num <= 4) || num === 23 || num === 24) {
      category = 'Commercial'; specialType = 'Commercial'; type = PlotType.COMMERCIAL;
    } else if ((num >= 5 && num <= 8) || num === 14 || (num >= 36 && num <= 40)) {
      category = 'EWS'; dimensions = 'EWS'; plotSizeLabel = 'EWS'; type = PlotType.EWS;
    } else if (num >= 9 && num <= 13) {
      width = 5.18; length = 15.24; dimensions = '5.18×15.24'; size = Math.round(5.18 * 15.24 * 100) / 100; plotSizeLabel = '5.18 × 15.24'; type = PlotType.NORMAL;
    } else if ((num >= 15 && num <= 21) || num === 81 || num === 87) {
      width = 5.48; length = 13.71; dimensions = '5.48×13.71'; size = Math.round(5.48 * 13.71 * 100) / 100; plotSizeLabel = '5.48 × 13.71'; type = PlotType.NORMAL;
    } else if (num === 22 || num === 59 || num === 73 || (num >= 82 && num <= 85)) {
      dimensions = 'Irregular'; plotSizeLabel = 'Irregular'; specialType = 'Irregular'; type = 'Irregular';
    } else if (
      (num >= 25 && num <= 35) || (num >= 41 && num <= 47) || 
      (num >= 74 && num <= 80) || num === 86 || (num >= 88 && num <= 110)
    ) {
      width = 6.09; length = 15.24; dimensions = '6.09×15.24'; size = Math.round(6.09 * 15.24 * 100) / 100; plotSizeLabel = '6.09 × 15.24'; type = PlotType.NORMAL;
    } else if (num >= 67 && num <= 72) {
      width = 4.87; length = 13.71; dimensions = '4.87×13.71'; size = Math.round(4.87 * 13.71 * 100) / 100; plotSizeLabel = '4.87 × 13.71'; type = PlotType.NORMAL;
    }

    return { ...plot, dimensions, size, width, length, plotSizeLabel, type, category, specialType };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 110,
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

const MORTGAGED_SHIVAJI_PLOTS = new Set([
  1, 2, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
  32, 33, 34, 35, 37, 38, 39, 40, 41, 42, 43, 44, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
  58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
  82, 83, 84, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 108, 109, 111, 112,
  130, 131, 132, 155, 156, 157, 158, 159, 160, 161, 162, 163, 174, 175, 176, 177, 178,
  179, 180, 196, 203
]);

export const applyShivajiParkOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isShivaji = 
    normalizedName === 'shivaji park' || 
    normalizedName.includes('shivaji') || 
    p.id === 16;

  if (!isShivaji) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;
    let category = plot.category;
    let specialType = plot.specialType;
    let isMortgaged = plot.isMortgaged;
    let remarks = plot.remarks;

    if (MORTGAGED_SHIVAJI_PLOTS.has(num)) {
      isMortgaged = true;
      specialType = 'Mortgaged';
      if (!remarks || !remarks.includes('Mortgaged')) {
        remarks = remarks ? `${remarks}; Mortgaged` : 'Mortgaged';
      }
    }

    if (num >= 3 && num <= 7) {
      width = 13.1; length = 44.3; dimensions = '13.1×44.3'; size = Math.round(13.1 * 44.3 * 100) / 100; plotSizeLabel = '13.1 × 44.3'; type = PlotType.NORMAL;
    } else if (num === 45 || num === 46 || num === 57 || num === 69 || num === 70 || (num >= 85 && num <= 87)) {
      width = 13; length = 40; dimensions = '13×40'; size = 520; plotSizeLabel = '13 × 40'; type = PlotType.NORMAL;
    } else if ((num >= 101 && num <= 107) || num === 110 || (num >= 113 && num <= 154)) {
      width = 15; length = 40; dimensions = '15×40'; size = 600; plotSizeLabel = '15 × 40'; type = PlotType.NORMAL;
    } else if ((num >= 164 && num <= 173) || (num >= 181 && num <= 195) || num === 204 || num === 205) {
      width = 20; length = 40; dimensions = '20×40'; size = 800; plotSizeLabel = '20 × 40'; type = PlotType.NORMAL;
    }

    return { ...plot, dimensions, size, width, length, plotSizeLabel, type, category, specialType, isMortgaged, remarks };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 205,
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

export const applyMeeraValleyOfficialSizes = (p: Project): Project => {
  const normalizedName = p.name.toLowerCase().trim();
  const isMeeraValley = 
    normalizedName === 'meera valley' || 
    (normalizedName.includes('meera') && normalizedName.includes('valley')) || 
    p.id === 15;

  if (!isMeeraValley) {
    return p;
  }

  const mapPlot = (plot: Plot): Plot => {
    const numStr = plot.number.replace(/^[Pp]-/, '');
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return plot;

    let dimensions = plot.dimensions;
    let size = plot.size;
    let width = plot.width;
    let length = plot.length;
    let plotSizeLabel = plot.plotSizeLabel;
    let type = plot.type || PlotType.NORMAL;
    let category = plot.category;
    let specialType = plot.specialType;

    if (num >= 1 && num <= 4) {
      category = 'Shop Cum Residential'; width = 40; length = 70; dimensions = '40×70'; size = 2800; plotSizeLabel = '40 × 70'; specialType = 'Shop Cum Residential';
    } else if (num >= 156 && num <= 158) {
      category = 'Shop Cum Residential'; width = 60; length = 60; dimensions = '60×60'; size = 3600; plotSizeLabel = '60 × 60'; specialType = 'Shop Cum Residential';
    } else if (num === 14) {
      specialType = 'Miscellaneous'; dimensions = 'Miscellaneous'; plotSizeLabel = 'Miscellaneous'; type = 'Not Configured';
    }

    return { ...plot, dimensions, size, width, length, plotSizeLabel, type, category, specialType };
  };

  const updatedLayout = p.layout ? p.layout.map(mapPlot) : [];
  const updatedPlots = p.plots ? p.plots.map(mapPlot) : [];

  return {
    ...p,
    totalPlots: updatedPlots.length > 0 ? updatedPlots.length : 185,
    layout: updatedLayout,
    plots: updatedPlots,
  };
};

const generatePlots = (count: number, projectId: number): Plot[] => {
  const plots: Plot[] = [];
  for (let i = 1; i <= count; i++) {
    plots.push({
      id: (projectId * 1000) + i, // Unique plot id
      number: `P-${String(i).padStart(3, '0')}`,
      size: 0,
      dimensions: 'Not Configured',
      facing: PlotFacing.NOT_CONFIGURED,
      status: PlotStatus.SOLD,
      type: 'Not Configured',
      price: 0,
      isMortgaged: false,
    });
  }
  return plots;
};

const generateVrindavanPlots = (): Plot[] => {
  const plots: Plot[] = [];
  
  const officialVrindavanData: Record<number, number> = {
    1: 1786.63,
    2: 1519,
    3: 1063.03,
    5: 921,
    6: 788,
    7: 1063.03,
    37: 800,
    40: 675,
    43: 675,
    50: 675,
    51: 763.17,
    52: 675,
    59: 675,
    62: 509.48,
    63: 434.40,
    64: 625,
    65: 525,
    66: 625,
    73: 625,
    74: 675,
    92: 675,
    93: 1068,
    101: 675,
    102: 675,
    103: 618.83,
    144: 675,
    145: 675,
  };

  for (let i = 1; i <= 165; i++) {
    const officialArea = officialVrindavanData[i];
    const size = officialArea !== undefined ? officialArea : 0;

    plots.push({
      id: 1000 + i, // Unique plot id for project 1
      number: `P-${String(i).padStart(3, '0')}`,
      size,
      dimensions: 'Not Configured',
      facing: PlotFacing.NOT_CONFIGURED,
      status: PlotStatus.SOLD,
      type: 'Not Configured',
      price: 0,
      isMortgaged: false,
    });
  }
  return plots;
};

// Generate plot data for all projects
const vrindavanPlots = generateVrindavanPlots();
const divinePlots = generatePlots(236, 3);
const maaGinniExtPlots = generatePlots(195, 4);
const maaGinniPlots = generatePlots(340, 5);
const greenwoodPlots = generatePlots(254, 6);
const redwoodPlots = generatePlots(227, 7);
const shantiViharPlots = generatePlots(299, 9);
const ginniparkPlots = generatePlots(103, 10);
const shrinathDreamCityPlots = generatePlots(93, 11);
const redwoodPlatinumExtPlots = generatePlots(68, 13);
const meeraGovindParkPlots = generatePlots(110, 14);
const meeraValleyPlots = generatePlots(185, 15);

const INTERNAL_MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    name: 'Vrindavan Dream City',
    location: 'Back Side of Veterinary College, Mhow Highway, Mhow',
    status: 'Ongoing',
    category: 'EWS: 10, LIG: 5',
    plotSizes: '15×45, 17×45, 15×35, 12×30',
    plotDimensions: '15×45, 17×45, 15×35, 12×30',
    description: "Vrindavan Dream City is a well-planned township near Rau, Indore, combining modern infrastructure with serene living. It features a grand entrance gate, secure boundary walls, and 30-foot-wide concrete roads for safety and convenience. Beautiful gardens with walking tracks enhance the lifestyle, while a double-capacity overhead water tank ensures uninterrupted supply. Close to top schools like Medi-Caps and Penfield International, it’s perfect for families.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68396668b3090-1748592232.png', 'https://dhanshriinfrabulls.co.in/uploads/68396631a79ba-1748592177.jpg', 'https://dhanshriinfrabulls.co.in/uploads/683965aaa62eb-1748592042.jpg', 'https://dhanshriinfrabulls.co.in/uploads/683964865bf38-1748591750.jpg'],
    totalPlots: vrindavanPlots.length,
    availablePlots: vrindavanPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.64, lng: 75.81 },
    layout: vrindavanPlots,
    plots: vrindavanPlots,
    amenities: [
      'Electricity with LED Street Lighting',
      '24×7 CCTV Surveillance & Security Guard',
      'Underground Drainage System',
      'Large Underground Water Storage with Proper Pipeline Network',
      'Rainwater Harvesting System',
      'Overhead Water Tank',
      'Lush Green Gardens',
      'Dedicated Kids Play Area',
      '25 ft Wide Roads'
    ],
  },
  {
    id: 3,
    name: 'Divine Park',
    location: 'Pigdamber, Rau, On AB Bypass Road, Indore',
    status: 'Ongoing',
    category: 'EWS: 20, LIG: 12',
    plotSizes: '20×41, 20×46, 20×48, 23×44, 15×44, 19×44, 20×40, 20×37, 20×45, 16.66×50, 20×26',
    plotDimensions: '20×41, 20×46, 20×48, 23×44, 15×44, 19×44, 20×40, 20×37, 20×45, 16.66×50, 20×26',
    description: "Divine Park is a promising residential project in Pigdambar, Indore, offering various home options to suit different budgets. RERA-registered, it ensures transparency and trust for buyers and investors. The project enjoys excellent connectivity, with Rau railway station and key landmarks like Dr. P.S. Hardia Eye Institute nearby. Located in the affordable and developing locality of Pigdambar, Divine Park is ideal for homebuyers seeking a balanced lifestyle.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68396cf598a5b-1748593909.png', 'https://dhanshriinfrabulls.co.in/uploads/68396c19203d2-1748593689.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68396ab5a7d5f-1748593333.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68396a6010a78-1748593248.jpg'],
    totalPlots: divinePlots.length,
    availablePlots: divinePlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.62, lng: 75.815 },
    layout: divinePlots,
    plots: divinePlots,
    amenities: [
      'Electricity & Maintenance Charges Included',
      'RERA Approved with Building Permission',
      'TNCP Approved Diversion',
      '24×7 CCTV Surveillance & Security Guard',
      'Underground Drainage System',
      'Huge Underground Water Storage & Pipeline',
      'Rainwater Harvesting',
      'Overhead Water Tank',
      'Lush Green Gardens',
      'Kids Play Area',
      '30 ft Wide Roads'
    ],
  },
  {
    id: 4,
    name: 'Maa Ginni Vihar Extension',
    location: 'Nearby New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore',
    status: 'Ongoing',
    category: 'EWS: 10, LIG: 13',
    plotSizes: '15×35, 12×35, 17×50, 20×55, 20×60',
    plotDimensions: '15×35, 12×35, 17×50, 20×55, 20×60',
    description: "Maa Ginni Vihar Extension is a premium residential township near Rau, Indore, offering a peaceful yet well-connected lifestyle. Spread across multiple acres, it features lush central greens, playgrounds, and well-planned recreational spaces—perfect for families seeking comfort, convenience, and community living. Its strategic location ensures easy access to reputed schools, hospitals, shopping centers, and entertainment hubs.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/6851309dba645-1750151325.jpg', 'https://dhanshriinfrabulls.co.in/uploads/6851306152e51-1750151265.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68513026f2fe8-1750151206.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68512ff738765-1750151159.jpg'],
    totalPlots: maaGinniExtPlots.length,
    availablePlots: maaGinniExtPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.645, lng: 75.805 },
    layout: maaGinniExtPlots,
    plots: maaGinniExtPlots,
    amenities: [],
  },
  {
    id: 5,
    name: 'Maa Ginni Vihar',
    location: 'Nearby New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore',
    status: 'Ongoing',
    category: 'EWS: 20, LIG: 15, NA: 4',
    plotSizes: '17×50, 20×40, 15×40, 15.9×29.9, 13.4×26.3, NA',
    plotDimensions: '17×50, 20×40, 15×40, 15.9×29.9, 13.4×26.3, NA',
    description: "Maa Ginni Vihar is a premium residential township near Rau, Indore, offering a peaceful yet well-connected lifestyle. Spread across acres of lush green spaces and recreational areas, it’s perfect for families seeking comfort, convenience, and community living. Located close to reputed schools, hospitals, shopping malls, and entertainment hubs, it ensures everything you need is nearby.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68270ea3a5309-1747390115.png', 'https://dhanshriinfrabulls.co.in/uploads/68ca954fe17d8-1758106959.jpeg', 'https://dhanshriinfrabulls.co.in/uploads/68ca954fd9af5-1758106959.jpeg', 'https://dhanshriinfrabulls.co.in/uploads/68ca954fcc8d8-1758106959.jpeg'],
    totalPlots: maaGinniPlots.length,
    availablePlots: maaGinniPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.638, lng: 75.812 },
    layout: maaGinniPlots,
    plots: maaGinniPlots,
    amenities: [
      'Covered Boundary Wall',
      '24×7 CCTV & Security Guard',
      '30 ft Wide RCC Roads with Parking',
      'Underground Electricity with LED Street Lights',
      'Underground Drainage System',
      'Huge Underground Water Storage',
      'Overhead Water Tank',
      'Rainwater Harvesting',
      'Jogging Track',
      'Lush Green Gardens',
      'Kids Play Area'
    ],
  },
  {
    id: 6,
    name: 'GreenWood Park',
    location: 'Pigdamber, Rau, Near Sanghvi College, Indore',
    status: 'Ongoing',
    category: 'EWS: 19, LIG: 8',
    plotSizes: '20×60, 20×55, 20×45, 20×40, 18×40, 15×40, 10.8×32, 18×45, 18×52.6',
    plotDimensions: '20×60, 20×55, 20×45, 20×40, 18×40, 15×40, 10.8×32, 18×45, 18×52.6',
    description: "GreenWood Park is a gated residential project in Rau, Indore, offering a perfect blend of comfort and connectivity. It features wide concrete roads, landscaped gardens, a peaceful temple, and essential modern amenities. With excellent access to IIM Indore, Pithampur, and A.B. Road, it ensures smooth daily commutes. The project is close to schools, hospitals, markets, and entertainment hubs, making life convenient for families.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68317ff24316a-1748074482.png', 'https://dhanshriinfrabulls.co.in/uploads/68513c190350c-1750154265.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68513bd7b9d46-1750154199.jpg', 'https://dhanshriinfrabulls.co.in/uploads/683861893f65a-1748525449.jpg'],
    totalPlots: greenwoodPlots.length,
    availablePlots: greenwoodPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.642, lng: 75.80 },
    layout: greenwoodPlots,
    plots: greenwoodPlots,
    amenities: [],
  },
  {
    id: 7,
    name: 'Redwood Platinum',
    location: 'Pigdamber, Rau, Indore',
    status: 'Ongoing',
    category: 'EWS: 20, LIG: 9',
    plotSizes: '25×75, 20×55, 23×50, 20×50, 23×45, 23×60, 50×90, 11×34.60, 12×34',
    plotDimensions: '25×75, 20×55, 23×50, 20×50, 23×45, 23×60, 50×90, 11×34.60, 12×34',
    description: "Red Wood Platinum is a premium township at Pigdamber, Rau, Indore, offering luxurious living with wide cement concrete roads, pleasant gardens, and modern amenities. Surrounded by top schools, colleges like IIM Indore, hospitals, malls, and entertainment hubs, it ensures convenience and comfort. The project features double-capacity overhead water tanks and serene walking tracks.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68397ec5b9ecb-1748598469.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68397d1698662-1748598038.jpg', 'https://dhanshriinfrabulls.co.in/uploads/6833ffcf1db07-1748238287.png', 'https://dhanshriinfrabulls.co.in/uploads/6833ff73cc8c0-1748238195.jpg'],
    totalPlots: redwoodPlots.length,
    availablePlots: redwoodPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.618, lng: 75.81 },
    layout: redwoodPlots,
    plots: redwoodPlots,
    amenities: [
      'Electricity with LED Street Lighting',
      '24×7 CCTV & Security Guard',
      'Underground Drainage System',
      'Huge Underground Water Storage with Proper Pipeline Network',
      'Rainwater Harvesting System',
      'Overhead Water Tank',
      'Lush Green Gardens',
      'Kids Play Area',
      '30 ft Wide Roads'
    ],
  },
  {
    id: 9,
    name: 'Shanti Vihar',
    projectCode: 'SV-IND',
    status: 'Upcoming',
    location: 'Nearby New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore',
    propertyType: 'Residential & Commercial Plots',
    totalPlots: shantiViharPlots.length,
    availablePlots: shantiViharPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    category: 'EWS: 19, LIG: 14',
    approval: 'TNCP Approved',
    specialFeature: 'Luxury Plots with Two-Way Homes Concept',
    plotSizes: '15×45, 17×45, 20×40, 20×45, 25×40, 20×55',
    plotDimensions: '15×45, 17×45, 20×40, 20×45, 25×40, 20×55',
    residentialRate: '₹2,830/Sq.Ft.',
    commercialRate: '₹3,500/Sq.Ft.',
    paymentOptions: 'Cash, EMI, Loan',
    amenities: [
      '30 Ft Wide Roads',
      '60 Ft Commercial Road',
      'Underground Electricity',
      'LED Street Lights',
      'CCTV Surveillance',
      'Security Guard',
      'Underground Drainage',
      'Underground Water Storage',
      'Water Pipeline',
      'Rainwater Harvesting',
      'Overhead Water Tank',
      'Green Garden',
      'Kids Play Area',
      'Community Hall'
    ],
    description: "Shanti Vihar is a premium TNCP-approved pre-launch residential and commercial township located near New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore. Designed with the unique Two-Way Homes Concept, the project offers modern infrastructure, premium amenities, and excellent investment potential. With well-planned roads, underground utilities, security systems, and green open spaces, Shanti Vihar is ideal for both homebuyers and investors.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68396668b3090-1748592232.png', 'https://dhanshriinfrabulls.co.in/uploads/68396631a79ba-1748592177.jpg'],
    coords: { lat: 22.632, lng: 75.808 },
    layout: shantiViharPlots,
    plots: shantiViharPlots,
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-07-06T10:00:00Z',
    isActive: true,
    featuredProject: true,
    displayOrder: 1
  },
  {
    id: 10,
    name: 'Maa Ginni Park',
    projectCode: 'MGP-RAU',
    status: 'Upcoming',
    location: 'Nearby New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore',
    propertyType: 'Residential & Commercial Plots',
    totalPlots: ginniparkPlots.length,
    availablePlots: ginniparkPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    category: 'EWS: 6, LIG: 4',
    approval: 'TNCP Approved with Development',
    specialFeature: 'Luxury Two-Way Homes Concept, Premium 1100 Sq.Ft. Plots',
    plotSizes: '15×45, 17×45, 20×40, 20×45, 25×40, 20×55',
    plotDimensions: '15×45, 17×45, 20×40, 20×45, 25×40, 20×55',
    residentialRate: '₹3,500/Sq.Ft.',
    commercialRate: '₹3,330/Sq.Ft.',
    paymentOptions: 'Cash, EMI, Loan',
    amenities: [
      '30 Ft Roads',
      'Underground Electricity',
      'LED Street Lights',
      'CCTV Surveillance',
      'Security Guard',
      'Underground Drainage',
      'Water Storage',
      'Water Pipeline',
      'Rainwater Harvesting',
      'Overhead Water Tank',
      'Green Garden',
      'Kids Play Area',
      'Community Hall'
    ],
    description: "Maa Ginni Park is a TNCP-approved pre-launch residential and commercial township offering premium plots with a luxury Two-Way Homes Concept. Located in Rau, it provides modern infrastructure, secure surroundings, green landscapes, and excellent connectivity, making it an attractive destination for families and investors.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68270ea3a5309-1747390115.png', 'https://dhanshriinfrabulls.co.in/uploads/68ca954fe17d8-1758106959.jpeg'],
    coords: { lat: 22.635, lng: 75.815 },
    layout: ginniparkPlots,
    plots: ginniparkPlots,
    createdAt: '2026-02-15T11:00:00Z',
    updatedAt: '2026-07-06T11:00:00Z',
    isActive: true,
    featuredProject: true,
    displayOrder: 2
  },
  {
    id: 11,
    name: 'Shrinath Dream City',
    projectCode: 'SDC-IND',
    status: 'Ongoing',
    location: 'Back Side of Veterinary College, Mhow Highway, Mhow',
    propertyType: 'Residential Plots',
    totalPlots: shrinathDreamCityPlots.length,
    availablePlots: shrinathDreamCityPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    category: 'EWS: 5, LIG: 3',
    approval: 'TNCP Approved',
    specialFeature: 'Limited inventory with quality infrastructure',
    plotSizes: '15×45, 15×40, 20×40, 20×35, 11.8×34.44, 12×32, 21.97×59.368',
    plotDimensions: '15×45, 15×40, 20×40, 20×35, 11.8×34.44, 12×32, 21.97×59.368',
    residentialRate: '₹2,600/Sq.Ft.',
    commercialRate: undefined,
    paymentOptions: 'Electricity & Maintenance Included',
    amenities: [
      'Electricity Included',
      'Maintenance Included'
    ],
    description: "Shrinath Dream City is a premium pre-launch residential plotting project situated near the Veterinary College on Mhow Highway. The township offers limited inventory with quality infrastructure, affordable pricing, and excellent investment potential in one of the fastest-growing locations.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/667bf7bc7154f-1719400380.jpg', 'https://dhanshriinfrabulls.co.in/uploads/667d0d438c888-1719471427.jpg'],
    coords: { lat: 22.78, lng: 75.88 },
    layout: shrinathDreamCityPlots,
    plots: shrinathDreamCityPlots,
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-07-06T12:00:00Z',
    isActive: true,
    featuredProject: false,
    displayOrder: 3
  },
  {
    id: 13,
    name: 'Redwood Platinum Extension',
    projectCode: 'RPE-PIG',
    status: 'Ongoing',
    location: 'Pigdamber, Rau, Indore',
    propertyType: 'Residential Plots',
    totalPlots: redwoodPlatinumExtPlots.length,
    availablePlots: redwoodPlatinumExtPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    category: 'EWS: 5, LIG: 3, SR: 3',
    approval: 'TNCP Approved',
    specialFeature: 'Pre-launch residential township with limited inventory',
    plotSizes: '12×35, 20×50, 22×50, 20×52, 23×52, 20×60',
    plotDimensions: '12×35, 20×50, 22×50, 20×52, 23×52, 20×60',
    residentialRate: '₹4,300/Sq.Ft.',
    commercialRate: undefined,
    paymentOptions: 'Electricity & Maintenance Included',
    amenities: [
      'Electricity Included',
      'Maintenance Included'
    ],
    description: "Redwood Platinum Extension is a premium pre-launch residential township located at Pigdamber, Rau. It offers limited inventory with spacious plots, planned infrastructure, and excellent future appreciation.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/6833ffcf1db07-1748238287.png', 'https://dhanshriinfrabulls.co.in/uploads/6833ff73cc8c0-1748238195.jpg'],
    coords: { lat: 22.62, lng: 75.812 },
    layout: redwoodPlatinumExtPlots,
    plots: redwoodPlatinumExtPlots,
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-07-06T08:00:00Z',
    isActive: true,
    featuredProject: false,
    displayOrder: 5
  },
  {
    id: 14,
    name: 'Meera Govind Park',
    projectCode: 'MGP-IND',
    status: 'Upcoming',
    location: 'Pigdamber, Rau, Indore',
    propertyType: 'Residential & Commercial Plots',
    totalPlots: meeraGovindParkPlots.length,
    availablePlots: meeraGovindParkPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    category: 'EWS: 6, LIG: 6',
    approval: 'TNCP Approved Diversion',
    specialFeature: 'Premium pre-launch residential and commercial plotting',
    plotSizes: '17×45, 18×45, 16×45, 20×50',
    plotDimensions: '17×45, 18×45, 16×45, 20×50',
    residentialRate: '₹3,800/Sq.Ft.',
    commercialRate: undefined,
    paymentOptions: 'Electricity Included, Maintenance Included',
    amenities: [
      'Electricity Included',
      'Maintenance Included',
      'Well-Planned Infrastructure'
    ],
    description: "Meera Govind Park is a premium pre-launch residential and commercial plotting project in Pigdamber, Rau. The township is TNCP-approved with planned infrastructure and offers excellent opportunities for residential living and long-term investment.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68396cf598a5b-1748593909.png', 'https://dhanshriinfrabulls.co.in/uploads/68396c19203d2-1748593689.jpg'],
    coords: { lat: 22.71, lng: 75.92 },
    layout: meeraGovindParkPlots,
    plots: meeraGovindParkPlots,
    createdAt: '2026-05-20T14:00:00Z',
    updatedAt: '2026-07-06T14:00:00Z',
    isActive: true,
    featuredProject: false,
    displayOrder: 6
  },
  {
    id: 15,
    name: 'Meera Valley',
    projectCode: 'MV-IND',
    status: 'Upcoming',
    location: 'Pigdamber, Rau, Near Medicaps University, Front of La Sagesse Academy, Indore',
    propertyType: 'Residential & Commercial Plots',
    totalPlots: meeraValleyPlots.length,
    availablePlots: meeraValleyPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    category: 'EWS: 14, LIG: 6',
    approval: 'RERA Approved with Building Permission, TNCP Approved Diversion',
    specialFeature: 'Near Medicaps University, Front of Lasagaugs Academy',
    plotSizes: '13×45, 15×40, 15×45, 18×40, 20×45, 20×50, 25×45, 25×55, 30×50',
    plotDimensions: '13×45, 15×40, 15×45, 18×40, 20×45, 20×50, 25×45, 25×55, 30×50',
    residentialRate: '₹3,850/Sq.Ft.',
    commercialRate: undefined,
    paymentOptions: 'Electricity Included, Maintenance Included',
    amenities: [
      'Electricity Included',
      'Maintenance Included',
      'CCTV Surveillance',
      'Security Guard',
      'Underground Drainage',
      'Underground Water Storage',
      'Water Pipeline',
      'Rainwater Harvesting',
      'Overhead Water Tank',
      'Green Garden',
      'Kids Play Area',
      '30 Ft Roads'
    ],
    description: "Meera Valley is a premium RERA-approved residential and commercial township located at Pigdamber, Rau, near Medicaps University and Lasagaugs Academy. The project offers modern infrastructure, premium amenities, excellent connectivity, and high future appreciation, making it ideal for families and investors.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68340f3103373-1748242225.jpeg', 'https://dhanshriinfrabulls.co.in/uploads/683d95156407d-1748866325.jpeg'],
    coords: { lat: 22.618, lng: 75.72 },
    layout: meeraValleyPlots,
    plots: meeraValleyPlots,
    createdAt: '2026-06-01T15:00:00Z',
    updatedAt: '2026-07-06T15:00:00Z',
    isActive: true,
    featuredProject: false,
    displayOrder: 7
  }
];

export const MOCK_PROJECTS: Project[] = INTERNAL_MOCK_PROJECTS
  .map(standardizeProjectPlots)
  .map(applyMaaGinniViharOfficialSizes)
  .map(applyVrindavanDreamCityOfficialSizes)
  .map(applyShriKeshvamCorridorOfficialSizes)
  .map(applyDivineParkOfficialSizes)
  .map(applyMaaGinniViharExtensionOfficialSizes)
  .map(applyMaaGinniParkOfficialSizes)
  .map(applyShantiViharOfficialSizes)
  .map(applyGreenwoodParkOfficialSizes)
  .map(applyRedwoodPlatinumOfficialSizes)
  .map(applyRedwoodPlatinumExtensionOfficialSizes)
  .map(applyShrinathDreamCityOfficialSizes)
  .map(applyMeeraGovindParkOfficialSizes)
  .map(applyMeeraValleyOfficialSizes);

export function getOfficialLocation(projectName: string): string {
  const name = projectName.trim().toLowerCase();
  if (name.includes('maa ginni vihar extension')) {
    return 'Nearby New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore';
  }
  if (name.includes('maa ginni vihar')) {
    return 'Nearby New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore';
  }
  if (name.includes('shanti vihar')) {
    return 'Nearby New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore';
  }
  if (name.includes('maa ginni park')) {
    return 'Nearby New Rajput Dhaba, Back Side Piplya Malhar, Rau, Indore';
  }
  if (name.includes('vrindavan dream city')) {
    return 'Back Side of Veterinary College, Mhow Highway, Mhow';
  }
  if (name.includes('shrinath dream city')) {
    return 'Back Side of Veterinary College, Mhow Highway, Mhow';
  }
  if (name.includes('greenwood park')) {
    return 'Pigdamber, Rau, Near Sanghvi College, Indore';
  }
  if (name.includes('redwood platinum extension')) {
    return 'Pigdamber, Rau, Indore';
  }
  if (name.includes('redwood platinum')) {
    return 'Pigdamber, Rau, Indore';
  }
  if (name.includes('meera govind park')) {
    return 'Pigdamber, Rau, Indore';
  }
  if (name.includes('meera valley')) {
    return 'Pigdamber, Rau, Near Medicaps University, Front of La Sagesse Academy, Indore';
  }
  if (name.includes('divine park')) {
    return 'Pigdamber, Rau, On AB Bypass Road, Indore';
  }
  return projectName; // Fallback
}

