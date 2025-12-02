/**
 * 荣耀运动健康 API 集成
 */
const HonorHealthConfig = {
  APP_ID: 'YOUR_APP_ID',
  APP_SECRET: 'YOUR_APP_SECRET',
  ACCESS_TOKEN: 'YOUR_ACCESS_TOKEN',
  API_BASE_URL: 'https://health-api.cloud.honor.com',
  USE_MOCK_DATA: true
};

class HonorHealthManager {
  constructor() {
    this.config = HonorHealthConfig;
    this.init();
  }

  init() {
    if (!document.querySelector('.card-health')) return;
    document.getElementById('health-refresh')?.addEventListener('click', () => this.refreshData());
    this.loadData();
    setInterval(() => this.loadData(), 5 * 60 * 1000);
  }

  async loadData() {
    try {
      const data = this.config.USE_MOCK_DATA ? this.getMockData() : await this.fetchHealthData();
      this.updateUI(data);
    } catch (e) {
      console.error('获取健康数据失败:', e);
      document.getElementById('health-update-time').textContent = '获取失败';
    }
  }

  getMockData() {
    const now = new Date();
    const hour = now.getHours();
    const history = [];
    
    for (let h = 0; h <= hour; h++) {
      let base = h < 6 ? 58 : h < 8 ? 65 : h < 12 ? 75 : h < 14 ? 80 : h < 18 ? 72 : h < 21 ? 78 : 65;
      history.push({ hour: h, value: base + Math.floor(Math.random() * 10) - 5 });
    }

    return {
      heartrate: history.length ? history[history.length - 1].value : 72,
      heartrateHistory: history,
      sleepStart: '23:30',
      sleepEnd: '07:15',
      isAwake: hour >= 7 && hour < 23,
      steps: Math.floor(Math.random() * 8000) + 2000,
      updateTime: now
    };
  }

  async fetchHealthData() {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.ACCESS_TOKEN}` };
    const start = new Date().setHours(0, 0, 0, 0);
    const end = Date.now();

    const [hr, sleep, steps] = await Promise.all([
      this.fetchHeartrate(headers, start, end),
      this.fetchSleep(headers, start, end),
      this.fetchSteps(headers, start, end)
    ]);

    return {
      heartrate: hr.current || '--',
      heartrateHistory: hr.history || [],
      sleepStart: sleep.startTime || '--:--',
      sleepEnd: sleep.endTime || '--:--',
      isAwake: sleep.isAwake !== false,
      steps: steps.count || '--',
      updateTime: new Date()
    };
  }

  async fetchHeartrate(headers, startTime, endTime) {
    try {
      const res = await fetch(`${this.config.API_BASE_URL}/v1/health/heartrate`, {
        method: 'POST', headers, body: JSON.stringify({ startTime, endTime, dataType: 'heartrate' })
      });
      const data = await res.json();
      if (data.data?.length) {
        const hourly = {};
        data.data.forEach(d => {
          const h = new Date(d.timestamp).getHours();
          hourly[h] = hourly[h] || [];
          hourly[h].push(d.heartRate);
        });
        const history = Object.entries(hourly).map(([h, v]) => ({
          hour: +h, value: Math.round(v.reduce((a, b) => a + b) / v.length)
        })).sort((a, b) => a.hour - b.hour);
        return { current: data.data[data.data.length - 1].heartRate, history };
      }
    } catch (e) { console.error(e); }
    return { current: null, history: [] };
  }

  async fetchSleep(headers, startTime, endTime) {
    try {
      const res = await fetch(`${this.config.API_BASE_URL}/v1/health/sleep`, {
        method: 'POST', headers, body: JSON.stringify({ startTime, endTime, dataType: 'sleep' })
      });
      const data = await res.json();
      if (data.data?.length) {
        const d = data.data[data.data.length - 1];
        const fmt = t => t ? `${String(new Date(t).getHours()).padStart(2,'0')}:${String(new Date(t).getMinutes()).padStart(2,'0')}` : '--:--';
        return { startTime: fmt(d.sleepStartTime), endTime: fmt(d.sleepEndTime), isAwake: d.sleepStatus === 1 };
      }
    } catch (e) { console.error(e); }
    return { startTime: null, endTime: null, isAwake: true };
  }

  async fetchSteps(headers, startTime, endTime) {
    try {
      const res = await fetch(`${this.config.API_BASE_URL}/v1/health/steps`, {
        method: 'POST', headers, body: JSON.stringify({ startTime, endTime, dataType: 'steps' })
      });
      const data = await res.json();
      if (data.data?.length) return { count: data.data.reduce((s, d) => s + d.steps, 0) };
    } catch (e) { console.error(e); }
    return { count: null };
  }

  updateUI(data) {
    const $ = id => document.getElementById(id);
    
    $('heartrate-value').textContent = data.heartrate;
    $('sleep-start').textContent = data.sleepStart;
    $('sleep-end').textContent = data.sleepEnd;
    
    const status = $('sleep-status');
    status.className = `sleep-status ${data.isAwake ? 'awake' : 'sleeping'}`;
    status.innerHTML = `<i class="fas fa-circle"></i><span>${data.isAwake ? '清醒' : '睡眠中'}</span>`;
    
    $('health-steps').textContent = typeof data.steps === 'number' ? data.steps.toLocaleString() : data.steps;
    $('health-update-time').textContent = `更新于 ${data.updateTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    
    this.drawChart(data.heartrateHistory);
  }

  drawChart(history) {
    const canvas = document.getElementById('heartrate-chart');
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement.offsetWidth - 8;
    const h = 37;
    
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    const vals = history.map(d => d.value);
    const min = Math.min(...vals) - 5, max = Math.max(...vals) + 5;
    const range = max - min || 1;
    const pad = { l: 2, r: 2, t: 4, b: 4 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

    // 渐变填充
    const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0.02)');

    ctx.beginPath();
    history.forEach((p, i) => {
      const x = pad.l + (i / (history.length - 1)) * cw;
      const y = pad.t + (1 - (p.value - min) / range) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.l + cw, h - pad.b);
    ctx.lineTo(pad.l, h - pad.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 折线
    ctx.beginPath();
    history.forEach((p, i) => {
      const x = pad.l + (i / (history.length - 1)) * cw;
      const y = pad.t + (1 - (p.value - min) / range) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 当前点
    const last = history[history.length - 1];
    const lx = pad.l + cw, ly = pad.t + (1 - (last.value - min) / range) * ch;
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  async refreshData() {
    const btn = document.getElementById('health-refresh');
    btn?.classList.add('loading');
    await this.loadData();
    setTimeout(() => btn?.classList.remove('loading'), 500);
  }
}

document.addEventListener('DOMContentLoaded', () => new HonorHealthManager());
