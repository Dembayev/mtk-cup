import { useState} from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const PredictionsScreen = ({ matches, teams, sponsors, prizes, predictions, user, onMakePrediction, users }) => {
  console.log("🎯 PredictionsScreen props:", { matches: matches?.length, teams: teams?.length, sponsors: sponsors?.length, prizes: prizes?.length, predictions: predictions?.length, user: user?.id });
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [prediction, setPrediction] = useState({ team1: 3, team2: 0 });
  
  // Ближайшие матчи для прогнозов (только upcoming)
  const upcomingMatches = (matches || [])
    .filter(m => m.status === "upcoming")
    .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
  
  // Мои прогнозы
  const myPredictions = (predictions || []).filter(p => p.user_id === user?.id);
  
  // Таблица лидеров
  const leaderboard = (() => {
    const scores = {};
    (predictions || []).forEach(p => {
      if (!scores[p.user_id]) scores[p.user_id] = 0;
      scores[p.user_id] += p.points_earned || 0;
    });
    return Object.entries(scores)
      .map(([id, pts]) => ({ user: (users || []).find(u => u.id === id), points: pts }))
      .filter(x => x.user && x.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  })();
  
  // Активный приз
  const activePrize = (prizes || []).find(p => p.is_active);
  const prizeSponsor = activePrize ? (sponsors || []).find(s => s.id === activePrize.sponsor_id) : null;
  
  const handleSubmitPrediction = async () => {
    if (!selectedMatch || !user) return;
    await onMakePrediction(selectedMatch.id, prediction.team1, prediction.team2);
    setSelectedMatch(null);
    setPrediction({ team1: 3, team2: 0 });
  };
  
    const getPrediction = (matchId) => myPredictions.find(p => p.match_id === matchId);
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Прогнозы" />
      <Container>
        {/* Активный розыгрыш */}
        {activePrize && prizeSponsor && (
          <Card style={{ marginBottom: "20px", background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`, color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {prizeSponsor.logo_url && (
                <img src={prizeSponsor.logo_url} alt={prizeSponsor.name} style={{ width: 50, height: 50, borderRadius: "10px", objectFit: "cover", background: "white" }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>🎁 Розыгрыш от {prizeSponsor.name}</div>
                <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>{activePrize.title}</div>
                {activePrize.description && <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "2px" }}>{activePrize.description}</div>}
              </div>
            </div>
          </Card>
        )}
        
        {/* Как это работает */}
        <Card style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 12px" }}>🎯 Как это работает</h3>
          <div style={{ fontSize: "13px", color: colors.goldDark, lineHeight: 1.6 }}>
            <div style={{ marginBottom: "8px" }}>• Угадай счёт матча до его начала</div>
            <div style={{ marginBottom: "8px" }}>• <span style={{ color: colors.gold, fontWeight: 600 }}>+3 очка</span> за точный счёт</div>
            <div style={{ marginBottom: "8px" }}>• <span style={{ color: colors.gold, fontWeight: 600 }}>+1 очко</span> за угаданного победителя</div>
            <div>• Лучшие прогнозисты получают призы!</div>
          </div>
        </Card>
        
        {/* Форма прогноза */}
        {selectedMatch && (
          <Card style={{ marginBottom: "20px", border: `2px solid ${colors.gold}` }}>
            <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 16px", textAlign: "center" }}>Ваш прогноз</h4>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>
                  {teams.find(t => t.id === selectedMatch.team1_id)?.name}
                </div>
                <select 
                  value={prediction.team1} 
                  onChange={e => setPrediction(p => ({ ...p, team1: parseInt(e.target.value) }))}
                  style={{ width: "60px", padding: "12px", fontSize: "20px", fontWeight: 700, textAlign: "center", border: `2px solid ${colors.gold}`, borderRadius: "8px" }}
                >
                  {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>:</div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>
                  {teams.find(t => t.id === selectedMatch.team2_id)?.name}
                </div>
                <select 
                  value={prediction.team2} 
                  onChange={e => setPrediction(p => ({ ...p, team2: parseInt(e.target.value) }))}
                  style={{ width: "60px", padding: "12px", fontSize: "20px", fontWeight: 700, textAlign: "center", border: `2px solid ${colors.gold}`, borderRadius: "8px" }}
                >
                  {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            {(prediction.team1 !== 3 && prediction.team2 !== 3) && (
              <p style={{ color: "#dc2626", fontSize: "12px", textAlign: "center", marginTop: "8px" }}>Одна из команд должна набрать 3 сета</p>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <Button 
                onClick={handleSubmitPrediction} 
                disabled={prediction.team1 !== 3 && prediction.team2 !== 3}
                style={{ flex: 1 }}
              >
                Отправить прогноз
              </Button>
              <Button variant="outline" onClick={() => setSelectedMatch(null)}>Отмена</Button>
            </div>
          </Card>
        )}
        
        {/* Список матчей */}
        <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Ближайшие матчи</h3>
        {upcomingMatches.length === 0 ? (
          <Card><p style={{ color: colors.goldDark, textAlign: "center" }}>Нет предстоящих матчей</p></Card>
        ) : (
          upcomingMatches.map(match => {
            const team1 = teams.find(t => t.id === match.team1_id);
            const team2 = teams.find(t => t.id === match.team2_id);
            const myPred = getPrediction(match.id);
            const matchTime = match.scheduled_time?.substring(11, 16) || "";
            
            return (
              <Card key={match.id} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>{team1?.name} vs {team2?.name}</div>
                    <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "4px" }}>
                      {matchTime && `⏰ ${matchTime}`}
                    </div>
                  </div>
                  {myPred ? (
                    <div style={{ textAlign: "center", padding: "8px 12px", background: colors.goldLight, borderRadius: "8px" }}>
                      <div style={{ fontSize: "11px", color: colors.goldDark }}>Ваш прогноз</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>
                        {myPred.predicted_score_team1}:{myPred.predicted_score_team2}
                      </div>
                    </div>
                  ) : user ? (
                    <Button onClick={() => setSelectedMatch(match)} style={{ padding: "8px 16px" }}>
                      Прогноз
                    </Button>
                  ) : (
                    <Badge variant="default">Войдите</Badge>
                  )}
                </div>
              </Card>
            );
          })
        )}
        
        {/* Таблица лидеров */}
        <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "24px 0 12px" }}>🏆 Таблица лидеров</h3>
        <Card>
          {leaderboard.length === 0 ? (
            <p style={{ color: colors.goldDark, textAlign: "center" }}>Пока нет результатов</p>
          ) : (
            leaderboard.map((item, i) => (
              <div key={item.user.id} style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                padding: "10px 0",
                borderBottom: i < leaderboard.length - 1 ? `1px solid ${colors.grayBorder}` : "none"
              }}>
                <div style={{ 
                  width: "28px", 
                  height: "28px", 
                  borderRadius: "50%", 
                  background: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : colors.gray,
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: i < 3 ? "white" : colors.text
                }}>
                  {i + 1}
                </div>
                <Avatar name={item.user.first_name || item.user.username} size={36} url={item.user.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{item.user.first_name || item.user.username} {item.user.last_name || ""}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: "18px", color: colors.gold }}>{item.points}</div>
              </div>
            ))
          )}
        </Card>
      </Container>
    </div>
  );
};

