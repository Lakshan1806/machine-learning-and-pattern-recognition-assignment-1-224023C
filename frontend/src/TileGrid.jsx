import React, {useState} from 'react';

const storageKey = 'comparison-tile-order-v1';
const spans = {
  metric: 'min-[36rem]:col-span-2',
  wide: 'col-span-full',
  chart: 'col-span-full md:col-span-3',
};

export default function TileGrid({tiles, editing}) {
  const [order, setOrder] = useState(() => {
    const ids = tiles.map(tile => tile.id);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(saved)) {
        return [...new Set([...saved.filter(id => ids.includes(id)), ...ids])];
      }
    } catch {
      // The layout also works when browser storage is unavailable.
    }
    return ids;
  });
  const [dragged, setDragged] = useState(null);
  const [target, setTarget] = useState(null);

  function move(id, destination) {
    const source = order.indexOf(id);
    if (source < 0 || destination < 0 || destination >= order.length || source === destination) return;
    const next = [...order];
    next.splice(source, 1);
    next.splice(destination, 0, id);
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Keep the current session's order.
    }
  }

  function endDrag() {
    setDragged(null);
    setTarget(null);
  }

  return <div className="grid grid-cols-1 gap-[clamp(12px,1.5vw,24px)] min-[36rem]:grid-cols-6">{order.map((id, index) => {
      const tile = tiles.find(item => item.id === id);
      const highlight = target === id && dragged !== id ? 'outline-2 -outline-offset-2 outline-dashed outline-[#207361]' : '';
      return <div key={id} className={`panel min-w-0 p-[clamp(16px,2vw,30px)] ${spans[tile.size]} ${highlight}`}
        onDragOver={event => {
          if (dragged) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setTarget(id);
          }
        }}
        onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget)) setTarget(null);}}
        onDrop={event => {
          if (dragged) {
            event.preventDefault();
            move(dragged, index);
            endDrag();
          }
        }}>
        {editing && <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <span className="cursor-grab p-[5px] text-muted select-none" draggable onDragStart={event => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', id);
            setDragged(id);
          }} onDragEnd={endDrag}>⠿ Drag</span>
          <label>Position <select value={index} aria-label={'Position of ' + tile.label}
            onChange={event => move(id, Number(event.target.value))}>
            {order.map((key, position) => <option value={position} key={key}>{position + 1}</option>)}
          </select></label>
        </div>}
        {tile.content}
      </div>;
    })}</div>;
}
