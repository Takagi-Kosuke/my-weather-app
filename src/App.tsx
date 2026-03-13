import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHouseUser, faTree, faLocationArrow, faPlusCircle, 
  faCloudSun, faCheckCircle, faHeart, faMapMarkerAlt, 
  faStickyNote, faCalendarAlt 
} from '@fortawesome/free-solid-svg-icons';

// 型定義
interface WeatherForecastItem {
  dt_txt: string;
  main: { temp: number };
  weather: { description: string }[];
}

interface Spot {
  id: number;
  name: string;
  lat: number;
  lng: number;
  isIndoor: boolean;
  isVisited: boolean;
  isFavorite: boolean;
  memo: string;
  address: string;
  weather?: string;
  temp?: number;
}

// 地図の移動制御
function MapController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 14, { duration: 1.2 });
      setTimeout(() => map.invalidateSize(), 300);
    }
  }, [target, map]);
  return null;
}

// カスタムピンの作成
const createCustomIcon = (isIndoor: boolean, isVisited: boolean, isFavorite: boolean) => {
  let color = isVisited ? "#919191" : (isIndoor ? "#ea4335" : "#34a853");
  if (isFavorite && !isVisited) color = "#ffc107";
  const iconName = isIndoor ? "house-user" : "tree";
  const html = `
    <div class="custom-pin">
      <svg width="34" height="42" viewBox="0 0 384 512">
        <path fill="${color}" stroke="white" stroke-width="20" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
      </svg>
      <div class="pin-icon-inner"><i class="fas fa-${iconName}"></i></div>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [34, 42], iconAnchor: [17, 42] });
};

function App() {
  const [spots, setSpots] = useState<Spot[]>([
    { id: 1, name: "東京駅", lat: 35.6812, lng: 139.7671, isIndoor: true, isVisited: false, isFavorite: true, memo: "お土産を買う", address: "東京都千代田区丸の内１丁目" },
    { id: 2, name: "代々木公園", lat: 35.671, lng: 139.694, isIndoor: false, isVisited: true, isFavorite: false, memo: "ピクニックに最適", address: "東京都渋谷区代々木神園町２−１" },
    { id: 3, name: "横浜みなとみらい", lat: 35.453, lng: 139.637, isIndoor: false, isVisited: false, isFavorite: false, memo: "夜景が綺麗", address: "神奈川県横浜市西区みなとみらい" }
  ]);

  const [selectedSpotId, setSelectedSpotId] = useState<number | null>(null);
  const [mapTarget, setMapTarget] = useState<[number, number] | null>(null);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newIsIndoor, setNewIsIndoor] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDate, setSelectedDate] = useState("2026-03-14");
  const [visitFilter, setVisitFilter] = useState<'all' | 'unvisited' | 'visited'>('all');
  const [favFilter, setFavFilter] = useState<boolean>(false);

  const API_KEY = "3eef9e11a6e96650627794053a3d3529";

  // 天気取得ロジック
  useEffect(() => {
    const fetchWeather = async () => {
      const updated = await Promise.all(spots.map(async (spot) => {
        try {
          const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${spot.lat}&lon=${spot.lng}&appid=${API_KEY}&units=metric&lang=ja`);
          const data = await res.json();
          // 指定した日付の予報を探す
          const forecast = data.list?.find((item: WeatherForecastItem) => item.dt_txt.startsWith(selectedDate)) || data.list?.[0];
          return forecast ? { ...spot, weather: forecast.weather[0].description, temp: Math.round(forecast.main.temp) } : spot;
        } catch { return spot; }
      }));
      setSpots(updated);
    };
    fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, spots.length]);

  const selectedSpot = useMemo(() => spots.find(s => s.id === selectedSpotId) || null, [spots, selectedSpotId]);

  // 県別グループ化ロジックの復活
  const groupedSpots = useMemo(() => {
    const filtered = spots.filter(s => {
      const v = visitFilter === 'all' || (visitFilter === 'visited' ? s.isVisited : !s.isVisited);
      const f = !favFilter || s.isFavorite;
      return v && f;
    });

    return filtered.reduce((acc, spot) => {
      const match = spot.address.match(/^.*?[都道府県]/);
      const pref = match ? match[0] : "その他";
      if (!acc[pref]) acc[pref] = [];
      acc[pref].push(spot);
      return acc;
    }, {} as Record<string, Spot[]>);
  }, [spots, visitFilter, favFilter]);

  const handleAddSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAddress) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newAddress)}&limit=1`);
      const data = await res.json();
      if (data?.[0]) {
        const newSpot: Spot = {
          id: Date.now(),
          name: newName,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          isIndoor: newIsIndoor,
          isVisited: false,
          isFavorite: false,
          memo: "",
          address: newAddress
        };
        setSpots(prev => [...prev, newSpot]);
        setNewName("");
        setNewAddress("");
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="main-layout">
      {/* ヘッダー：カレンダーを中に収める */}
      <header className="app-header">
        <div className="header-left">
          <span className="logo-icon">☀️</span>
          <h1>お出かけ天気ナビ</h1>
        </div>
        <div className="header-right">
          <div className="date-selector">
            <FontAwesomeIcon icon={faCalendarAlt} className="cal-icon" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
            />
          </div>
          <div className="spot-count">{spots.length} / {spots.length} SPOTS</div>
        </div>
      </header>

      <div className="app-content">
        {/* 左サイドバー：登録とリスト */}
        <aside className="sidebar-left">
          <section className="registration-area">
            <h2 className="section-title"><FontAwesomeIcon icon={faPlusCircle} /> 新規登録</h2>
            <form onSubmit={handleAddSpot}>
              <input 
                className="input-field" 
                placeholder="スポット名" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
              />
              <input 
                className="input-field" 
                placeholder="住所を入力" 
                value={newAddress} 
                onChange={e => setNewAddress(e.target.value)} 
              />
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={newIsIndoor} 
                  onChange={e => setNewIsIndoor(e.target.checked)} 
                /> 屋内施設
              </label>
              <button type="submit" className="btn-submit" disabled={isSearching}>
                {isSearching ? "検索中..." : "登録"}
              </button>
            </form>
          </section>

          <section className="list-area">
            <div className="filter-tabs">
              <button className={visitFilter === 'all' ? 'active' : ''} onClick={() => setVisitFilter('all')}>すべて</button>
              <button className={visitFilter === 'unvisited' ? 'active' : ''} onClick={() => setVisitFilter('unvisited')}>未訪問</button>
              <button className={visitFilter === 'visited' ? 'active' : ''} onClick={() => setVisitFilter('visited')}>行った</button>
            </div>
            <button 
              className={`btn-fav-filter ${favFilter ? 'active' : ''}`} 
              onClick={() => setFavFilter(!favFilter)}
            >
              <FontAwesomeIcon icon={faHeart} /> お気に入り
            </button>

            <div className="grouped-spot-list">
              {Object.entries(groupedSpots).map(([pref, prefSpots]) => (
                <div key={pref} className="prefecture-group">
                  <div className="prefecture-header">{pref}</div>
                  {prefSpots.map(spot => (
                    <div 
                      key={spot.id} 
                      className={`spot-card ${selectedSpotId === spot.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedSpotId(spot.id);
                        setMapTarget([spot.lat, spot.lng]);
                      }}
                    >
                      <FontAwesomeIcon icon={spot.isIndoor ? faHouseUser : faTree} className="spot-icon" />
                      <span className="spot-name">{spot.name}</span>
                      {spot.isFavorite && <FontAwesomeIcon icon={faHeart} className="fav-star" />}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* 中央：地図エリア（flex:1で広げる） */}
        <main className="map-wrapper">
          <MapContainer center={[35.6812, 139.7671]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapController target={mapTarget} />
            {spots.map(spot => (
              <Marker 
                key={spot.id} 
                position={[spot.lat, spot.lng]} 
                icon={createCustomIcon(spot.isIndoor, spot.isVisited, spot.isFavorite)}
                eventHandlers={{ click: () => setSelectedSpotId(spot.id) }}
              />
            ))}
          </MapContainer>
          <button className="my-location-btn">
            <FontAwesomeIcon icon={faLocationArrow} />
          </button>
        </main>

        {/* 右サイドバー：詳細情報 */}
        <aside className="sidebar-right">
          {selectedSpot ? (
            <div className="detail-content">
              <div className="detail-header-btns">
                <button 
                  className={`btn-action ${selectedSpot.isVisited ? 'active' : ''}`}
                  onClick={() => setSpots(prev => prev.map(s => s.id === selectedSpot.id ? {...s, isVisited: !s.isVisited} : s))}
                >
                  <FontAwesomeIcon icon={faCheckCircle} /> 行った！
                </button>
                <button 
                  className={`btn-action fav ${selectedSpot.isFavorite ? 'active' : ''}`}
                  onClick={() => setSpots(prev => prev.map(s => s.id === selectedSpot.id ? {...s, isFavorite: !s.isFavorite} : s))}
                >
                  <FontAwesomeIcon icon={faHeart} /> お気に入り
                </button>
              </div>

              <h2 className="detail-title">{selectedSpot.name}</h2>
              <p className="detail-address">{selectedSpot.address}</p>

              <div className="weather-card">
                <div className="temp-display">{selectedSpot.temp ?? '--'}<small>℃</small></div>
                <div className="weather-desc">
                  <FontAwesomeIcon icon={faCloudSun} /> {selectedSpot.weather ?? '取得中...'}
                </div>
              </div>

              <div className="memo-section">
                <label><FontAwesomeIcon icon={faStickyNote} /> メモ</label>
                <textarea 
                  placeholder="メモを入力..."
                  value={selectedSpot.memo}
                  onChange={e => setSpots(prev => prev.map(s => s.id === selectedSpot.id ? {...s, memo: e.target.value} : s))}
                />
              </div>
            </div>
          ) : (
            <div className="detail-empty">
              <FontAwesomeIcon icon={faMapMarkerAlt} size="3x" />
              <p>スポットを選択してください</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;