import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Bell, Settings, Plus, X, BarChart3, List } from 'lucide-react';

const TrappedCandleMobileApp = () => {
  const [watchList, setWatchList] = useState(['EURUSD', 'GBPUSD', 'USDJPY']);
  const [newSymbol, setNewSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('M5');
  const [candlesData, setCandlesData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showSetup, setShowSetup] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [activeTab, setActiveTab] = useState('chart');
  const [showAddSymbol, setShowAddSymbol] = useState(false);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  };

  // Play alert sound
  const playAlertSound = () => {
    if (soundEnabled) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  };

  // Send push notification
  const sendPushNotification = (alert) => {
    if (notificationsEnabled && notificationPermission === 'granted') {
      const notification = new Notification(`${alert.symbol} Alert`, {
        body: `${alert.type} trapped candle at ${alert.price}`,
        icon: '🔔',
        badge: '⚠️',
        tag: alert.symbol,
        requireInteraction: false
      });

      notification.onclick = () => {
        window.focus();
        setSelectedSymbol(alert.symbol);
        setActiveTab('chart');
        notification.close();
      };
    }
  };

  // Check notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  // Detect trapped candles
  const detectTrappedCandle = (current, previous) => {
    if (!current || !previous) return false;

    const currentBullish = current.close > current.open;
    const previousBullish = previous.close > previous.open;

    if (currentBullish !== previousBullish) return false;

    if (currentBullish) {
      const prevWickTop = previous.high;
      const prevBodyTop = previous.close;
      return current.close > prevBodyTop && current.close <= prevWickTop;
    } else {
      const prevWickBottom = previous.low;
      const prevBodyBottom = previous.close;
      return current.close < prevBodyBottom && current.close >= prevWickBottom;
    }
  };

  // Generate simulated data
  const generateSimulatedData = (symbol) => {
    const data = [];
    let price = symbol.includes('JPY') ? 145.50 : 1.0850;
    const now = Date.now();

    for (let i = 0; i < 50; i++) {
      const change = (Math.random() - 0.48) * 0.003;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 0.002;
      const low = Math.min(open, close) - Math.random() * 0.002;

      data.push({
        timestamp: new Date(now - (50 - i) * 300000).toLocaleTimeString(),
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5)),
        volume: Math.floor(Math.random() * 1000)
      });

      price = close;
    }

    return data;
  };

  // Check for trapped candles
  const checkForTrappedCandles = (data, symbol) => {
    const newAlerts = [];
    
    for (let i = 1; i < data.length; i++) {
      if (detectTrappedCandle(data[i], data[i - 1])) {
        const isBullish = data[i].close > data[i].open;
        const alert = {
          id: Date.now() + i + Math.random(),
          timestamp: data[i].timestamp,
          type: isBullish ? 'Bullish' : 'Bearish',
          price: data[i].close,
          symbol: symbol,
          message: `${isBullish ? 'Bullish' : 'Bearish'} trapped candle at ${data[i].close}`
        };
        newAlerts.push(alert);
        
        if (isMonitoring) {
          playAlertSound();
          sendPushNotification(alert);
        }
      }
    }

    return newAlerts;
  };

  // Fetch data
  const fetchSymbolData = async (symbol) => {
    if (!apiKey || !accountId) {
      return generateSimulatedData(symbol);
    }

    try {
      const response = await fetch(
        `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${accountId}/historical-market-data/symbols/${symbol}/timeframes/${timeframe}/candles`,
        {
          headers: {
            'auth-token': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      
      return data.slice(-50).map(candle => ({
        timestamp: new Date(candle.time).toLocaleTimeString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.tickVolume || 0
      }));
    } catch (error) {
      return generateSimulatedData(symbol);
    }
  };

  // Fetch all data
  const fetchAllData = async () => {
    const newCandlesData = {};
    const allNewAlerts = [];

    for (const symbol of watchList) {
      const data = await fetchSymbolData(symbol);
      newCandlesData[symbol] = data;
      
      const newAlerts = checkForTrappedCandles(data, symbol);
      allNewAlerts.push(...newAlerts);
    }

    setCandlesData(newCandlesData);
    if (allNewAlerts.length > 0) {
      setAlerts(prev => [...allNewAlerts, ...prev].slice(0, 20));
    }
  };

  // Monitoring
  useEffect(() => {
    let interval;
    if (isMonitoring && watchList.length > 0) {
      fetchAllData();
      interval = setInterval(fetchAllData, 60000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, watchList, timeframe, apiKey, accountId]);

  // Watch list management
  const addSymbol = () => {
    const symbol = newSymbol.toUpperCase().trim();
    if (symbol && !watchList.includes(symbol)) {
      setWatchList([...watchList, symbol]);
      setNewSymbol('');
      setShowAddSymbol(false);
      if (!selectedSymbol) {
        setSelectedSymbol(symbol);
      }
    }
  };

  const removeSymbol = (symbol) => {
    setWatchList(watchList.filter(s => s !== symbol));
    if (selectedSymbol === symbol && watchList.length > 1) {
      setSelectedSymbol(watchList.find(s => s !== symbol));
    }
  };

  // Chart component
  const MobileChart = ({ data, symbol }) => {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="timestamp" 
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 10 }} width={50} />
          <Tooltip 
            contentStyle={{ fontSize: '12px' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-2 border-2 border-gray-300 rounded shadow-lg text-xs">
                    <p className="font-semibold">{data.timestamp}</p>
                    <p>O: {data.open}</p>
                    <p>H: {data.high}</p>
                    <p>L: {data.low}</p>
                    <p>C: {data.close}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line type="monotone" dataKey="high" stroke="#10b981" dot={false} strokeWidth={1} />
          <Line type="monotone" dataKey="low" stroke="#ef4444" dot={false} strokeWidth={1} />
          <Line 
            type="monotone" 
            dataKey="close" 
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={(props) => {
              const { cx, cy, payload, index } = props;
              const isTrapped = index > 0 && detectTrappedCandle(payload, data[index - 1]);
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isTrapped ? 5 : 2}
                  fill={isTrapped ? '#ef4444' : '#3b82f6'}
                  stroke={isTrapped ? '#dc2626' : '#3b82f6'}
                />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  // Setup screen
  if (showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 mt-8">
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
                <Bell className="w-12 h-12 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Trapped Candle Monitor</h1>
              <p className="text-sm text-gray-600">Real-time forex alerts on your phone</p>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-blue-900 font-semibold mb-2">📱 Install as App:</p>
              <p className="text-xs text-blue-800 mb-2">For best experience, add to home screen:</p>
              <ul className="text-xs text-blue-700 space-y-1 ml-4">
                <li>• iOS: Tap Share → "Add to Home Screen"</li>
                <li>• Android: Tap Menu → "Install App"</li>
              </ul>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">MetaApi Token (Optional)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter token for live data"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Account ID (Optional)</label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="Enter account ID"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-yellow-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-yellow-800">
                Skip setup to use demo mode with simulated data
              </p>
            </div>

            <button
              onClick={() => setShowSetup(false)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition font-semibold shadow-lg"
            >
              {apiKey && accountId ? 'Start Live Monitoring' : 'Start Demo Mode'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Trapped Candle</h1>
            <p className="text-xs text-blue-100">
              {isMonitoring ? '🟢 Monitoring Active' : '⚪ Monitoring Paused'}
            </p>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'chart' && (
          <div className="p-4 space-y-4">
            {/* Symbol selector */}
            <div className="bg-white rounded-xl shadow-md p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700">Watch List</h2>
                <button
                  onClick={() => setShowAddSymbol(true)}
                  className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {watchList.map((symbol) => (
                  <div
                    key={symbol}
                    onClick={() => setSelectedSymbol(symbol)}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 cursor-pointer transition ${
                      selectedSymbol === symbol
                        ? 'bg-blue-500 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">{symbol}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-xl shadow-md p-3">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="M1">1 Min</option>
                  <option value="M5">5 Min</option>
                  <option value="M15">15 Min</option>
                  <option value="M30">30 Min</option>
                  <option value="H1">1 Hour</option>
                  <option value="H4">4 Hours</option>
                </select>
                <button
                  onClick={() => setIsMonitoring(!isMonitoring)}
                  className={`py-2 px-4 rounded-lg font-semibold text-sm transition ${
                    isMonitoring
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {isMonitoring ? 'Stop' : 'Start'}
                </button>
              </div>

              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>🔊 Sound</span>
                </label>
                
                {notificationPermission === 'granted' ? (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => setNotificationsEnabled(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>🔔 Push</span>
                  </label>
                ) : (
                  <button
                    onClick={requestNotificationPermission}
                    className="text-blue-600 font-semibold"
                  >
                    Enable 🔔
                  </button>
                )}
              </div>
            </div>

            {/* Chart */}
            {selectedSymbol && candlesData[selectedSymbol] && (
              <div className="bg-white rounded-xl shadow-md p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{selectedSymbol} Chart</h3>
                <MobileChart data={candlesData[selectedSymbol]} symbol={selectedSymbol} />
                <p className="text-xs text-gray-500 mt-2">Red dots = trapped candles</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="p-4">
            <div className="bg-white rounded-xl shadow-md p-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Recent Alerts</h2>
              
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No alerts yet</p>
                  <p className="text-xs">Start monitoring to receive alerts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border-l-4 ${
                        alert.type === 'Bullish'
                          ? 'bg-green-50 border-green-500'
                          : 'bg-red-50 border-red-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          {alert.type === 'Bullish' ? (
                            <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-600 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-semibold text-sm text-gray-800">
                              {alert.symbol}
                            </p>
                            <p className="text-xs text-gray-600">{alert.message}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">{alert.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 shadow-lg">
        <div className="flex justify-around max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex flex-col items-center py-2 px-4 rounded-lg transition ${
              activeTab === 'chart'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500'
            }`}
          >
            <BarChart3 className="w-6 h-6 mb-1" />
            <span className="text-xs font-semibold">Charts</span>
          </button>
          
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex flex-col items-center py-2 px-4 rounded-lg transition relative ${
              activeTab === 'alerts'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500'
            }`}
          >
            {alerts.length > 0 && (
              <span className="absolute top-1 right-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {alerts.length}
              </span>
            )}
            <List className="w-6 h-6 mb-1" />
            <span className="text-xs font-semibold">Alerts</span>
          </button>
        </div>
      </div>

      {/* Add Symbol Modal */}
      {showAddSymbol && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Add Pair</h3>
              <button
                onClick={() => setShowAddSymbol(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && addSymbol()}
              placeholder="e.g., EURUSD, GBPJPY"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <button
              onClick={addSymbol}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Add to Watch List
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaTraderTrappedCandleMonitor;
