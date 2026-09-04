import { LdiMachine } from '../../types/ldi';
import { ToleranceLevel } from '../../constants/colors';

export interface LaserSheetProps {
  machine: LdiMachine | null;
  boardNo: number;
  totalBoard: number;
  progressPct: number;
  tempTol: ToleranceLevel;
  humTol: ToleranceLevel;
}

export const LaserSheet = ({
  machine,
  boardNo,
  totalBoard,
  progressPct,
  tempTol,
  humTol,
}: LaserSheetProps) => (
  <div className="space-y-4 font-mono text-xs">
    {/* Manufacturing Order (MO) & Job Profile */}
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
        MANUFACTURING ORDER
      </div>
      <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-[11px]">MO NUMBER</span>
          <span className="font-bold text-slate-200">{machine?.mo || 'OFFLINE'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-[11px]">PART NUMBER (FPN)</span>
          <span className="text-slate-200 font-semibold">{machine?.fpn || '--'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-[11px]">PCB LAYER</span>
          <span className="text-slate-200">{machine?.layer_name || '--'}</span>
        </div>
      </div>
    </div>

    {/* Production Progress Bar */}
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-slate-400">
        <span>LOT PRODUCTION PROGRESS</span>
        <span className="text-slate-200 font-bold">
          {boardNo} / {totalBoard} boards ({progressPct}%)
        </span>
      </div>
      <div className="w-full h-2 bg-slate-950 border border-slate-800 rounded-sm overflow-hidden">
        <div
          className="h-full bg-slate-400 rounded-sm transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Cycle Exposure Time:</span>
        <span className="text-slate-300 font-semibold">
          {machine?.total_time != null ? `${machine.total_time.toFixed(1)} s` : '--'}
        </span>
      </div>
    </div>

    {/* Chamber Environment & Optics Grid */}
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
        CHAMBER ENVIRONMENT & OPTICS
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Temperature Cell */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500">TEMPERATURE</span>
            <span
              className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${
                tempTol === 'crit'
                  ? 'bg-red-950 text-red-400 border border-red-800'
                  : tempTol === 'warn'
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-400'
              }`}
            >
              {tempTol === 'ok' ? 'IN SPEC' : tempTol.toUpperCase()}
            </span>
          </div>
          <div className="text-lg font-bold text-slate-100 my-1">
            {machine?.temperature != null ? `${machine.temperature.toFixed(1)}°C` : '--'}
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 border-t border-slate-800/80 pt-1">
            <span>20°C</span>
            <span>Target 22±2°C</span>
            <span>24°C</span>
          </div>
        </div>

        {/* Humidity Cell */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500">HUMIDITY</span>
            <span
              className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${
                humTol === 'crit'
                  ? 'bg-red-950 text-red-400 border border-red-800'
                  : humTol === 'warn'
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-400'
              }`}
            >
              {humTol === 'ok' ? 'IN SPEC' : 'ALERT'}
            </span>
          </div>
          <div className="text-lg font-bold text-slate-100 my-1">
            {machine?.humidity != null ? `${machine.humidity.toFixed(1)}%` : '--'}
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 border-t border-slate-800/80 pt-1">
            <span>40%</span>
            <span>Target 45±5%</span>
            <span>50%</span>
          </div>
        </div>

        {/* Optical Dosage */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-500 mb-1">OPTICAL DOSAGE</div>
          <div className="text-base font-bold text-slate-100">
            {machine?.resist_dosage != null ? machine.resist_dosage.toFixed(2) : '--'}
          </div>
          <div className="text-[10px] text-slate-500">mJ/cm²</div>
        </div>

        {/* Scan Speed */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-500 mb-1">SCAN SPEED</div>
          <div className="text-base font-bold text-slate-100">
            {machine?.scan_speed != null ? machine.scan_speed.toFixed(1) : '--'}
          </div>
          <div className="text-[10px] text-slate-500">mm/s</div>
        </div>

        {/* Air Vacuum */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-500 mb-1">AIR VACUUM</div>
          <div className="text-base font-bold text-slate-100">
            {machine?.air_vacuum != null ? `${machine.air_vacuum.toFixed(1)} kPa` : '--'}
          </div>
          <div className="text-[10px] text-slate-500">kPa</div>
        </div>

        {/* Thickness */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-500 mb-1">THICKNESS</div>
          <div className="text-base font-bold text-slate-100">
            {machine?.thickness != null ? `${machine.thickness.toFixed(3)} mm` : '--'}
          </div>
          <div className="text-[10px] text-slate-500">mm</div>
        </div>
      </div>
    </div>
  </div>
);
