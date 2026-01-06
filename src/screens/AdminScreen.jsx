import { useState} from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { supabase } from '../lib/supabase';
import { sendNotification, sendTeamMessage } from '../utils/notifications';
import { positionLabels } from '../constants/labels';

export const AdminScreen = ({ setScreen, matches, teams, users, players, tours, playerStats, roleRequests, sponsors, prizes, predictions, onUpdateMatch, onUpdateUser, onAssignCoach, onDeleteTeam, onSetCaptain, onCreateTour, onUpdateTour, onDeleteTour, onCreateMatch, onUpdateMatchInfo, onDeleteMatch, onUpdateMatchVideo, onSavePlayerStat,  onDeleteUser, onApproveRequest, onRejectRequest, actionLoading, loadData, onUpdatePlayer, onChangeGameRole, onCreateTeam, onUpdateTeamInfo }) => {
  const [tab, setTab] = useState("tours");
  const [editingTour, setEditingTour] = useState(null);
  const [tourData, setTourData] = useState({ number: "", date: "", location: "", address: "" });
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchScore, setMatchScore] = useState({ 
    sets_team1: 0, sets_team2: 0, status: "upcoming",
    set1_team1: "", set1_team2: "", set2_team1: "", set2_team2: "", set3_team1: "", set3_team2: "",
    set4_team1: "", set4_team2: "", set5_team1: "", set5_team2: ""
  });
  const [editingUser, setEditingUser] = useState(null);
  const [userRole, setUserRole] = useState("fan");
  const [gameRole, setGameRole] = useState("fan");
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamCoach, setTeamCoach] = useState("");
  const [coachSearchQuery, setCoachSearchQuery] = useState("");
  const [isCoachListOpen, setIsCoachListOpen] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [teamMessage, setTeamMessage] = useState("");
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  
  // Прогнозы и спонсоры
  const [showAddSponsor, setShowAddSponsor] = useState(false);
  const [showAddPrize, setShowAddPrize] = useState(false);
  const [newSponsor, setNewSponsor] = useState({ name: "", logo_url: "", description: "" });
  const [uploadingSponsorLogo, setUploadingSponsorLogo] = useState(false);
  const [newPrize, setNewPrize] = useState({ sponsor_id: "", title: "", description: "", place: "1", tour_id: "" });
  
  const handleCreateSponsor = async () => {
    try {
      await supabase.from("sponsors").insert({ name: newSponsor.name, logo_url: newSponsor.logo_url || null, description: newSponsor.description || null });
      setNewSponsor({ name: "", logo_url: "", description: "" });
      setShowAddSponsor(false);
      await loadData();
      alert("Спонсор добавлен!");
    } catch (error) {
      console.error("Error creating sponsor:", error);
      alert("Ошибка добавления спонсора");
    }
  };

  const handleDeleteSponsor = async (id) => {
    if (!confirm("Удалить спонсора? Все связанные призы тоже будут удалены.")) return;
    try {
      await supabase.from("sponsors").delete().eq("id", id);
      await loadData();
    } catch (error) {
      console.error("Error deleting sponsor:", error);
      alert("Ошибка удаления");
    }
  };
  
  const handleCreatePrize = async () => {
    try {
      await supabase.from("prizes").insert({
        sponsor_id: newPrize.sponsor_id,
        title: newPrize.title,
        description: newPrize.description || null,
        place: parseInt(newPrize.place),
        tour_id: newPrize.tour_id || null
      });
      setNewPrize({ sponsor_id: "", title: "", description: "", place: "1", tour_id: "" });
      setShowAddPrize(false);
      await loadData();
      alert("Приз добавлен!");
    } catch (error) {
      console.error("Error creating prize:", error);
      alert("Ошибка добавления приза");
    }
  };
  
  const handleDeletePrize = async (id) => {
    if (!confirm("Удалить приз?")) return;
    try {
      await supabase.from("prizes").delete().eq("id", id);
      await loadData();
    } catch (error) {
      console.error("Error deleting prize:", error);
      alert("Ошибка удаления");
    }
  };
  
  // Создание тура
  const [showCreateTour, setShowCreateTour] = useState(false);
  const [newTour, setNewTour] = useState({ number: "", date: "", location: "", address: "" });
  
  // Создание матча
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [editingMatchInfo, setEditingMatchInfo] = useState(null);
  const [matchInfo, setMatchInfo] = useState({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
  const [newMatch, setNewMatch] = useState({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", logo_url: "" });
  const [editingTeamInfo, setEditingTeamInfo] = useState(null);
  const [teamInfo, setTeamInfo] = useState({ name: "", logo_url: "" });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Функция загрузки логотипа команды
  const handleUploadTeamLogo = async (file) => {
    try {
      setUploadingLogo(true);
      
      // Валидация файла
      if (!file) return null;
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return null;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('Размер файла не должен превышать 2MB');
        return null;
      }
      
      // Создаём уникальное имя файла
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `team-logos/${fileName}`;
      
      // Загружаем в Supabase Storage
      const { error } = await supabase.storage
        .from('team-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        console.error('Storage upload error:', error);
        alert('Ошибка загрузки изображения. Попробуйте ещё раз.');
        return null;
      }
      
      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('team-logos')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Ошибка загрузки логотипа');
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };
  
  // Загрузка логотипа спонсора
  const handleUploadSponsorLogo = async (file) => {
    try {
      setUploadingSponsorLogo(true);
      if (!file) return null;
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return null;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('Размер файла не должен превышать 2MB');
        return null;
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `sponsor-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `sponsor-logos/${fileName}`;
      
      const { error } = await supabase.storage
        .from('team-logos')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage.from('team-logos').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading sponsor logo:', error);
      alert('Ошибка загрузки логотипа');
      return null;
    } finally {
      setUploadingSponsorLogo(false);
    }
  };
  
  // Редактирование видео
  const [editingVideo, setEditingVideo] = useState(null);
  const [videoData, setVideoData] = useState({ stream_url: "", video_url: "" });

  // Редактирование игрока
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerJersey, setPlayerJersey] = useState("");
  const [playerPositions, setPlayerPositions] = useState([]);

  const startEditPlayer = (player) => {
    setEditingPlayer(player);
    setPlayerJersey(player.jersey_number || "");
    setPlayerPositions(player.positions || []);
  };

  const savePlayer = async () => {
    if (!editingPlayer || !onUpdatePlayer) return;
    await onUpdatePlayer(editingPlayer.id, playerJersey, playerPositions);
    setEditingPlayer(null);
  };

  const togglePosition = (pos) => {
    setPlayerPositions(prev => 
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const startEditMatch = (match) => {
    setEditingMatch(match);
    setMatchScore({
      sets_team1: match.sets_team1 || 0, sets_team2: match.sets_team2 || 0, status: match.status || "upcoming",
      set1_team1: match.set1_team1 || "", set1_team2: match.set1_team2 || "",
      set2_team1: match.set2_team1 || "", set2_team2: match.set2_team2 || "",
      set3_team1: match.set3_team1 || "", set3_team2: match.set3_team2 || "",
      set4_team1: match.set4_team1 || "", set4_team2: match.set4_team2 || "",
      set5_team1: match.set5_team1 || "", set5_team2: match.set5_team2 || "",
    });
  };

  const saveMatch = async () => {
    await onUpdateMatch(editingMatch.id, matchScore);
    setEditingMatch(null);
  };

  const startEditVideo = (match) => {
    setEditingVideo(match);
    setVideoData({ stream_url: match.stream_url || "", video_url: match.video_url || "" });
  };

  const saveVideo = async () => {
    await onUpdateMatchVideo(editingVideo.id, videoData);
    setEditingVideo(null);
  };

  const startEditUser = (u) => {
    setEditingUser(u);
    setUserRole(u.role === "admin" ? "admin" : "fan");
    setUserFirstName(u.first_name || "");
    setUserLastName(u.last_name || "");
    // Определяем текущую игровую роль (с учетом role_requests)
    const isCoach = teams.some(t => t.coach_id === u.id);
    const hasCoachRequest = roleRequests.some(r => r.user_id === u.id && r.requested_role === "coach" && r.status === "approved");
    const isPlayer = players.some(p => p.user_id === u.id);
    
    if (isCoach || hasCoachRequest) setGameRole("coach");
    else if (isPlayer) setGameRole("player");
    else setGameRole("fan");
  };

  const saveUser = async () => {
    console.log("💾 SaveUser: Starting", {
      userId: editingUser.id,
      selectedGameRole: gameRole,
      userRole,
      firstName: userFirstName,
      lastName: userLastName
    });
    
    // Обновляем имя, фамилию и права администратора
    await onUpdateUser(editingUser.id, userRole, userFirstName, userLastName);
    
    // Смена игровой роли (отдельно)
    const currentIsCoach = teams.some(t => t.coach_id === editingUser.id);
    const hasCoachRequest = roleRequests.some(r => r.user_id === editingUser.id && r.requested_role === "coach" && r.status === "approved");
    const currentIsPlayer = players.some(p => p.user_id === editingUser.id);
    let currentGameRole = "fan";
    if (currentIsCoach || hasCoachRequest) currentGameRole = "coach";
    else if (currentIsPlayer) currentGameRole = "player";
    
    console.log("💾 SaveUser: Current role analysis", {
      currentIsCoach,
      hasCoachRequest,
      currentIsPlayer,
      currentGameRole,
      selectedGameRole: gameRole,
      needsChange: gameRole !== currentGameRole
    });
    
    if (gameRole !== currentGameRole && onChangeGameRole) {
      console.log("💾 SaveUser: Calling onChangeGameRole");
      await onChangeGameRole(editingUser.id, gameRole);
    } else {
      console.log("💾 SaveUser: No role change needed or handler missing");
    }
    setEditingUser(null);
  };

  const startEditTeam = (team) => {
    setEditingTeam(team);
    setTeamCoach(team.coach_id || "");
    setCoachSearchQuery("");
    setIsCoachListOpen(false);
  };

  const saveTeam = async () => {
    await onAssignCoach(editingTeam.id, teamCoach || null);
    setEditingTeam(null);
    setCoachSearchQuery("");
    setIsCoachListOpen(false);
  };

  const toggleTeamExpand = (teamId) => {
    setExpandedTeam(expandedTeam === teamId ? null : teamId);
  };

  const localCreateTour = async () => {
    await onCreateTour(newTour);
    setNewTour({ number: "", date: "", location: "", address: "" });
    setShowCreateTour(false);
  };

  const localCreateMatch = async () => {
    await onCreateMatch(newMatch);
    setNewMatch({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
    setShowCreateMatch(false);
  };

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Админ-панель" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", overflowX: "auto" }}>
            {[
              { id: "tours", label: "Туры" },
              { id: "matches", label: "Матчи" },
              { id: "stats", label: "Статистика" },
              { id: "videos", label: "Видео" },
              { id: "users", label: "Пользователи" },
              { id: "teams", label: "Команды" },
              { id: "predictions", label: "Прогнозы" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 16px", borderRadius: "20px", border: "none",
                background: tab === t.id ? "#3b82f6" : colors.gray,
                color: tab === t.id ? "white" : colors.text,
                fontWeight: 600, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Tours tab */}
          {tab === "tours" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Туры ({tours.length})</h3>
                <Button onClick={() => setShowCreateTour(true)} style={{ padding: "8px 16px", fontSize: "13px" }}>
                  <Icons.Plus /> Создать тур
                </Button>
              </div>

              {showCreateTour && (
                <Card style={{ marginBottom: "16px", background: "#f0fdf4", border: "2px solid #16a34a" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#16a34a" }}>Новый тур</h4>
                  <Input label="Номер тура" type="number" value={newTour.number} onChange={v => setNewTour(p => ({ ...p, number: v }))} placeholder="1" />
                  <Input label="Дата" type="date" value={newTour.date} onChange={v => setNewTour(p => ({ ...p, date: v }))} />
                  <Input label="Место проведения" value={newTour.location} onChange={v => setNewTour(p => ({ ...p, location: v }))} placeholder="СК Олимп" />
                  <Input label="Адрес" value={newTour.address} onChange={v => setNewTour(p => ({ ...p, address: v }))} placeholder="ул. Спортивная, 1" />
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <Button onClick={localCreateTour} disabled={actionLoading || !newTour.number || !newTour.date} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> Создать
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateTour(false)} style={{ flex: 1, padding: "10px" }}>
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}

              {(tours || []).sort((a, b) => a.number - b.number).map(tour => (
                <Card key={tour.id} style={{ marginBottom: "8px", padding: "12px" }}>
                  {editingTour?.id === tour.id ? (
                    <div>
                      <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Редактирование тура</h4>
                      <Input label="Номер тура" type="number" value={tourData.number} onChange={v => setTourData(p => ({ ...p, number: v }))} />
                      <Input label="Дата" type="date" value={tourData.date} onChange={v => setTourData(p => ({ ...p, date: v }))} />
                      <Input label="Место" value={tourData.location} onChange={v => setTourData(p => ({ ...p, location: v }))} />
                      <Input label="Адрес" value={tourData.address} onChange={v => setTourData(p => ({ ...p, address: v }))} />
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <Button onClick={async () => {
                          await onUpdateTour(tour.id, tourData);
                          setEditingTour(null);
                        }} style={{ flex: 1 }}>
                          <Icons.Save /> Сохранить
                        </Button>
                        <Button variant="outline" onClick={() => setEditingTour(null)} style={{ flex: 1 }}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", background: colors.goldLight, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: colors.goldDark }}>
                        {tour.number}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>Тур {tour.number}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>
                          {new Date(tour.date).toLocaleDateString("ru-RU")} • {tour.location}
                        </div>
                        <div style={{ fontSize: "11px", color: colors.goldDark }}>{tour.address}</div>
                      </div>
                      <Badge>{(matches || []).filter(m => m.tour_id === tour.id).length} матчей</Badge>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => {
                          setEditingTour(tour);
                          setTourData({ number: tour.number, date: tour.date, location: tour.location, address: tour.address });
                        }} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }}>
                          <Icons.Edit />
                        </button>
                        <button onClick={() => onDeleteTour(tour.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }}>
                          <Icons.X />
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </>
          )}

          {/* Matches tab */}
          {tab === "matches" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Матчи</h3>
                <Button onClick={() => setShowCreateMatch(true)} style={{ padding: "8px 16px", fontSize: "13px" }}>
                  <Icons.Plus /> Создать матч
                </Button>
              </div>

              {showCreateMatch && (
                <Card style={{ marginBottom: "16px", background: "#f0fdf4", border: "2px solid #16a34a" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#16a34a" }}>Новый матч</h4>
                  <Select label="Тур" value={newMatch.tour_id} onChange={v => setNewMatch(p => ({ ...p, tour_id: v }))}
                    options={[{ value: "", label: "Выберите тур" }, ...(tours || []).map(t => ({ value: t.id, label: `Тур ${t.number} — ${new Date(t.date).toLocaleDateString("ru-RU")}` }))]}
                  />
                  <Select label="Команда 1" value={newMatch.team1_id} onChange={v => setNewMatch(p => ({ ...p, team1_id: v }))}
                    options={[{ value: "", label: "Выберите команду" }, ...(teams || []).map(t => ({ value: t.id, label: t.name }))]}
                  />
                  <Select label="Команда 2" value={newMatch.team2_id} onChange={v => setNewMatch(p => ({ ...p, team2_id: v }))}
                    options={[{ value: "", label: "Выберите команду" }, ...(teams || []).filter(t => t.id !== newMatch.team1_id).map(t => ({ value: t.id, label: t.name }))]}
                  />
                  <Input label="Время начала" type="datetime-local" value={newMatch.scheduled_time} onChange={v => setNewMatch(p => ({ ...p, scheduled_time: v }))} />
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <Button onClick={localCreateMatch} disabled={actionLoading || !newMatch.tour_id || !newMatch.team1_id || !newMatch.team2_id || !newMatch.scheduled_time} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> Создать
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateMatch(false)} style={{ flex: 1, padding: "10px" }}>
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}

              {(tours || []).map(tour => {
                const tourMatches = (matches || [])
                  .filter(m => m.tour_id === tour.id)
                  .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
                if (tourMatches.length === 0) return null;
                return (
                  <div key={tour.id} style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>
                      Тур {tour.number} — {new Date(tour.date).toLocaleDateString("ru-RU")}
                    </div>
                    {tourMatches.map(match => {
                      const team1 = teams.find(t => t.id === match.team1_id);
                      const team2 = teams.find(t => t.id === match.team2_id);
                      const isEditing = editingMatch?.id === match.id;
                      
                      return (
                        <Card key={match.id} style={{ marginBottom: "8px", padding: "12px" }}>
                          {isEditing ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px", textAlign: "center" }}>
                                {team1?.name} vs {team2?.name}
                              </div>
                              <div style={{ fontSize: "12px", color: colors.goldDark, marginBottom: "8px" }}>Введите счёт по сетам:</div>
                              {[1,2,3,4,5].map(setNum => (
                                <div key={setNum} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                  <span style={{ width: "50px", fontSize: "13px", color: colors.goldDark }}>Сет {setNum}</span>
                                  <input 
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={matchScore[`set${setNum}_team1`] ?? ""}
                                    onChange={e => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setMatchScore(prev => ({ ...prev, [`set${setNum}_team1`]: val === "" ? "" : parseInt(val) }));
                                    }}
                                    style={{ width: "60px", padding: "8px", textAlign: "center", borderRadius: "6px", border: `1px solid ${colors.grayBorder}` }}
                                  />
                                  <span>:</span>
                                  <input 
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={matchScore[`set${setNum}_team2`] ?? ""}
                                    onChange={e => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setMatchScore(prev => ({ ...prev, [`set${setNum}_team2`]: val === "" ? "" : parseInt(val) }));
                                    }}
                                    style={{ width: "60px", padding: "8px", textAlign: "center", borderRadius: "6px", border: `1px solid ${colors.grayBorder}` }}
                                  />
                                </div>
                              ))}
                              <div style={{ background: colors.gray, padding: "8px 12px", borderRadius: "6px", marginTop: "12px", fontSize: "13px" }}>
                                <strong>Итог:</strong> {
                                  [1,2,3,4,5].reduce((acc, n) => acc + (matchScore[`set${n}_team1`] > matchScore[`set${n}_team2`] ? 1 : 0), 0)
                                } : {
                                  [1,2,3,4,5].reduce((acc, n) => acc + (matchScore[`set${n}_team2`] > matchScore[`set${n}_team1`] ? 1 : 0), 0)
                                } (сеты) | Мячи: {
                                  [1,2,3,4,5].reduce((acc, n) => acc + (matchScore[`set${n}_team1`] || 0), 0)
                                }:{
                                  [1,2,3,4,5].reduce((acc, n) => acc + (matchScore[`set${n}_team2`] || 0), 0)
                                }
                              </div>
                              <Select label="Статус" value={matchScore.status} onChange={v => setMatchScore(prev => ({ ...prev, status: v }))}
                                options={[
                                  { value: "upcoming", label: "Предстоит" },
                                  { value: "live", label: "Live" },
                                  { value: "finished", label: "Завершён" },
                                ]}
                              />
                              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                <Button onClick={saveMatch} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                                  <Icons.Save /> Сохранить
                                </Button>
                                <Button variant="outline" onClick={() => setEditingMatch(null)} style={{ flex: 1, padding: "10px" }}>
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : editingMatchInfo?.id === match.id ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px", textAlign: "center" }}>
                                Редактирование матча
                              </div>
                              <Select 
                                label="Тур" 
                                value={matchInfo.tour_id} 
                                onChange={v => setMatchInfo(p => ({ ...p, tour_id: v }))}
                                options={[
                                  { value: "", label: "Выберите тур" },
                                  ...(tours || []).map(t => ({ value: t.id, label: `Тур ${t.number} — ${t.date}` }))
                                ]}
                              />
                              <Select 
                                label="Команда 1" 
                                value={matchInfo.team1_id} 
                                onChange={v => setMatchInfo(p => ({ ...p, team1_id: v }))}
                                options={[
                                  { value: "", label: "Выберите команду" },
                                  ...(teams || []).map(t => ({ value: t.id, label: t.name }))
                                ]}
                              />
                              <Select 
                                label="Команда 2" 
                                value={matchInfo.team2_id} 
                                onChange={v => setMatchInfo(p => ({ ...p, team2_id: v }))}
                                options={[
                                  { value: "", label: "Выберите команду" },
                                  ...(teams || []).filter(t => t.id !== matchInfo.team1_id).map(t => ({ value: t.id, label: t.name }))
                                ]}
                              />
                              <Input 
                                label="Дата и время" 
                                type="datetime-local" 
                                value={matchInfo.scheduled_time} 
                                onChange={v => setMatchInfo(p => ({ ...p, scheduled_time: v }))} 
                              />
                              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                <Button 
                                  onClick={async () => {
                                    await onUpdateMatchInfo(editingMatchInfo.id, matchInfo);
                                    setEditingMatchInfo(null);
                                  }} 
                                  disabled={actionLoading || !matchInfo.tour_id || !matchInfo.team1_id || !matchInfo.team2_id} 
                                  style={{ flex: 1, padding: "10px" }}
                                >
                                  <Icons.Save /> Сохранить
                                </Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setEditingMatchInfo(null)} 
                                  style={{ flex: 1, padding: "10px" }}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {/* Первая строка: команды и счёт */}
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <span style={{ flex: 1, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team1?.name}</span>
                                <span style={{ fontWeight: 700, fontSize: "16px", padding: "4px 12px", background: colors.gray, borderRadius: "6px", flexShrink: 0 }}>
                                  {match.sets_team1 || 0} : {match.sets_team2 || 0}
                                </span>
                                <span style={{ flex: 1, fontSize: "14px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team2?.name}</span>
                              </div>
                              {/* Вторая строка: статус и кнопки */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <Badge variant={match.status === "finished" ? "default" : match.status === "live" ? "live" : "gold"}>
                                  {match.status === "finished" ? "✓" : match.status === "live" ? "LIVE" : "○"}
                                </Badge>
                                {match.status === "upcoming" && (
                                  <button 
                                  onClick={() => { 
                                    sendNotification("hour_before", team1?.name, team2?.name);
                                    alert("Уведомление отправлено!");
                                  }} 
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#d97706", padding: "4px", fontSize: "16px" }}
                                  title="Отправить напоминание"
                                >
                                  🔔
                                </button>
                              )}
                              <button onClick={() => startEditMatch(match)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }} title="Редактировать результат">
                                <Icons.Edit />
                              </button>
                              <button onClick={() => {
                                setEditingMatchInfo(match);
                                // Конвертируем ISO формат в datetime-local формат
                                const localTime = match.scheduled_time ? match.scheduled_time.slice(0, 16) : "";
                                setMatchInfo({ 
                                  tour_id: match.tour_id, 
                                  team1_id: match.team1_id, 
                                  team2_id: match.team2_id, 
                                  scheduled_time: localTime
                                });
                              }} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", padding: "4px" }} title="Редактировать информацию">
                                ⚙️
                              </button>
                              <button onClick={() => onDeleteMatch(match.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }} title="Удалить матч">
                                <Icons.X />
                              </button>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          
          {/* Stats tab */}
          {tab === "stats" && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Статистика игроков по матчам</h3>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Выберите матч и введите статистику для каждого игрока
              </p>
              
              {(tours || []).map(tour => {
                const tourMatches = (matches || [])
                  .filter(m => m.tour_id === tour.id && m.status === "finished")
                  .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
                if (tourMatches.length === 0) return null;
                return (
                  <div key={tour.id} style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>
                      Тур {tour.number}
                    </div>
                    {tourMatches.map(match => {
                      const team1 = teams.find(t => t.id === match.team1_id);
                      const team2 = teams.find(t => t.id === match.team2_id);
                      const team1Players = (players || []).filter(p => p.team_id === match.team1_id);
                      const team2Players = (players || []).filter(p => p.team_id === match.team2_id);
                      const isExpanded = expandedMatch === match.id;
                      
                      return (
                        <Card key={match.id} style={{ marginBottom: "8px", padding: "12px" }}>
                          <div 
                            style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                            onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                          >
                            <span style={{ flex: 1, fontSize: "14px", fontWeight: 600 }}>
                              {team1?.name} {match.sets_team1}:{match.sets_team2} {team2?.name}
                            </span>
                            <span style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                              <Icons.ChevronRight />
                            </span>
                          </div>
                          
                          {isExpanded && (
                            <div style={{ marginTop: "16px", borderTop: `1px solid ${colors.grayBorder}`, paddingTop: "16px" }}>
                              {/* Team 1 */}
                              <div style={{ marginBottom: "16px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: colors.gold, marginBottom: "8px" }}>{team1?.name}</div>
                                {team1Players.map(player => {
                                  const existingStat = playerStats.find(s => s.player_id === player.id && s.match_id === match.id);
                                  return (
                                    <PlayerStatInput 
                                      key={player.id}
                                      player={player}
                                      matchId={match.id}
                                      existingStat={existingStat}
                                      onSave={onSavePlayerStat}
                                    />
                                  );
                                })}
                              </div>
                              {/* Team 2 */}
                              <div>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: colors.gold, marginBottom: "8px" }}>{team2?.name}</div>
                                {team2Players.map(player => {
                                  const existingStat = playerStats.find(s => s.player_id === player.id && s.match_id === match.id);
                                  return (
                                    <PlayerStatInput 
                                      key={player.id}
                                      player={player}
                                      matchId={match.id}
                                      existingStat={existingStat}
                                      onSave={onSavePlayerStat}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

{/* Videos tab */}
          {tab === "videos" && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Управление трансляциями и записями</h3>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Добавьте ссылки на трансляции (YouTube, VK, Rutube) и записи матчей
              </p>
              
              {(tours || []).map(tour => {
                const tourMatches = (matches || [])
                  .filter(m => m.tour_id === tour.id)
                  .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
                if (tourMatches.length === 0) return null;
                return (
                  <div key={tour.id} style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>
                      Тур {tour.number}
                    </div>
                    {tourMatches.map(match => {
                      const team1 = teams.find(t => t.id === match.team1_id);
                      const team2 = teams.find(t => t.id === match.team2_id);
                      const isEditing = editingVideo?.id === match.id;
                      
                      return (
                        <Card key={match.id} style={{ marginBottom: "8px", padding: "12px" }}>
                          {isEditing ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px" }}>
                                {team1?.name} vs {team2?.name}
                              </div>
                              <Input 
                                label="Ссылка на трансляцию (Live)" 
                                value={videoData.stream_url} 
                                onChange={v => setVideoData(p => ({ ...p, stream_url: v }))} 
                                placeholder="https://youtube.com/watch?v=..."
                              />
                              <Input 
                                label="Ссылка на запись" 
                                value={videoData.video_url} 
                                onChange={v => setVideoData(p => ({ ...p, video_url: v }))} 
                                placeholder="https://youtube.com/watch?v=..."
                              />
                              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                <Button onClick={saveVideo} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                                  <Icons.Save /> Сохранить
                                </Button>
                                <Button variant="outline" onClick={() => setEditingVideo(null)} style={{ flex: 1, padding: "10px" }}>
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <span style={{ fontWeight: 600, fontSize: "14px", flex: 1 }}>
                                  {team1?.name} vs {team2?.name}
                                </span>
                                <Badge variant={match.status === "finished" ? "default" : match.status === "live" ? "live" : "gold"}>
                                  {match.status === "finished" ? "Завершён" : match.status === "live" ? "LIVE" : "Предстоит"}
                                </Badge>
                              </div>
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                                {match.stream_url ? (
                                  <Badge variant="live">📺 Трансляция</Badge>
                                ) : (
                                  <Badge variant="default">Нет трансляции</Badge>
                                )}
                                {match.video_url ? (
                                  <Badge variant="free">📹 Запись</Badge>
                                ) : (
                                  <Badge variant="default">Нет записи</Badge>
                                )}
                              </div>
                              <Button variant="outline" onClick={() => startEditVideo(match)} style={{ width: "100%", padding: "8px", fontSize: "13px" }}>
                                <Icons.Video /> Редактировать видео
                              </Button>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* Users tab - ИСПРАВЛЕННЫЙ */}
          {tab === "users" && (
            <>
              {/* Заявки на роль */}
              {(roleRequests || []).filter(r => r.status === "pending").length > 0 && (
                <Card style={{ marginBottom: "20px", background: "#fef3c7", border: "1px solid #f59e0b" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px", color: "#92400e" }}>
                    📋 Заявки на роль ({(roleRequests || []).filter(r => r.status === "pending").length})
                  </h3>
                  {(roleRequests || []).filter(r => r.status === "pending").map(request => {
                    const requestUser = users.find(u => u.id === request.user_id);
                    return (
                      <div key={request.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "white", borderRadius: "8px", marginBottom: "8px" }}>
                        <Avatar name={requestUser?.first_name || requestUser?.username} size={40} url={requestUser?.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {request.first_name && request.last_name 
                              ? `${request.first_name} ${request.last_name}` 
                              : (requestUser?.first_name || requestUser?.username) + (requestUser?.last_name ? ` ${requestUser.last_name}` : "")}
                            {request.first_name && <span style={{ fontSize: "11px", color: "#16a34a", marginLeft: "6px" }}>✓ Указал имя</span>}
                          </div>
                          <div style={{ fontSize: "12px", color: colors.goldDark }}>
                            Хочет стать: <strong>{request.requested_role === "player" ? "Игроком" : request.requested_role === "coach" ? "Тренером" : "Болельщиком"}</strong>
                          </div>
                          {request.positions && request.positions.length > 0 && (
                            <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "4px" }}>
                              Амплуа: <strong>{request.positions.map(p => positionLabels[p] || p).join(", ")}</strong>
                            </div>
                          )}
                          {request.team_name && (
                            <div style={{ fontSize: "11px", color: "#2563eb", marginTop: "4px" }}>
                              🏐 Команда: <strong>{request.team_name}</strong>
                            </div>
                          )}
                          <div style={{ fontSize: "11px", color: colors.goldDark }}>
                            {new Date(request.created_at).toLocaleDateString("ru-RU")}
                          </div>
                        </div>
                        {requestUser?.username && (
                          <button 
                            onClick={() => window.open(`https://t.me/${requestUser.username}`, '_blank')}
                            style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", cursor: "pointer" }}
                          >
                            💬 Написать
                          </button>
                        )}
                        <button 
                          onClick={() => onApproveRequest(request.id, request.user_id, request.requested_role)}
                          disabled={actionLoading}
                          style={{ background: "#16a34a", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
                        >
                          ✓ Одобрить
                        </button>
                        <button 
                          onClick={() => onRejectRequest(request.id)}
                          disabled={actionLoading}
                          style={{ background: "#dc2626", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </Card>
              )}
              
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Управление пользователями ({users.length})</h3>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "12px" }}>
                Роли вычисляются автоматически: Тренер — если назначен на команду, Капитан — если отмечен в составе, Игрок — если есть в players
              </p>
              
              {/* Поиск пользователей */}
              <div style={{ marginBottom: "16px" }}>
                <Input 
                  label="Поиск"
                  value={userSearchQuery}
                  onChange={setUserSearchQuery}
                  placeholder="Введите имя или фамилию..."
                />
              </div>
              
              {users.filter(u => {
                if (!userSearchQuery) return true;
                const query = userSearchQuery.toLowerCase();
                const fullName = `${u.first_name || ""} ${u.last_name || ""} ${u.username || ""}`.toLowerCase();
                return fullName.includes(query);
              }).map(u => {
                const isEditing = editingUser?.id === u.id;
                const userPlayerRecord = players.find(p => p.user_id === u.id);
                const userCoachTeam = teams.find(t => t.coach_id === u.id);
                const hasCoachRequest = (roleRequests || []).some(r => r.user_id === u.id && r.requested_role === "coach" && r.status === "approved");
                
                // Вычисляем все роли пользователя (как это делает getUserRoles)
                const displayRoles = [];
                if (u.role === "admin") displayRoles.push({ label: "Админ", variant: "admin" });
                // Тренер если: назначен на команду ИЛИ есть одобренная заявка
                if (userCoachTeam) {
                  displayRoles.push({ label: `Тренер (${userCoachTeam.name})`, variant: "gold" });
                } else if (hasCoachRequest) {
                  displayRoles.push({ label: "Тренер (не назначен)", variant: "gold" });
                }
                if (userPlayerRecord?.is_captain) displayRoles.push({ label: "Капитан", variant: "captain" });
                if (userPlayerRecord) displayRoles.push({ label: "Игрок", variant: "free" });
                if (displayRoles.length === 0) displayRoles.push({ label: "Болельщик", variant: "default" });
                
                return (
                  <Card key={u.id} style={{ marginBottom: "8px", padding: "12px" }}>
                    {isEditing ? (
                      <div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
                          {displayRoles.map((role, i) => (
                            <Badge key={i} variant={role.variant}>{role.label}</Badge>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                          <Input 
                            label="Имя" 
                            value={userFirstName} 
                            onChange={setUserFirstName}
                            placeholder="Имя"
                            style={{ flex: 1 }}
                          />
                          <Input 
                            label="Фамилия" 
                            value={userLastName} 
                            onChange={setUserLastName}
                            placeholder="Фамилия"
                            style={{ flex: 1 }}
                          />
                        </div>
                        <Select label="Права администратора" value={userRole} onChange={setUserRole}
                          options={[
                            { value: "fan", label: "Обычный пользователь" },
                            { value: "admin", label: "Администратор" },
                          ]}
                        />
                        <Select label="Роль" value={gameRole} onChange={setGameRole}
                          options={[
                            { value: "fan", label: "Болельщик" },
                            { value: "player", label: "Игрок" },
                            { value: "coach", label: "Тренер" },
                          ]}
                        />
                        {/* Disabled: Make Player button */}

                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                          <Button onClick={saveUser} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                            <Icons.Save /> Сохранить
                          </Button>
                          <Button variant="outline" onClick={() => setEditingUser(null)} style={{ flex: 1, padding: "10px" }}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <Avatar name={u.first_name || u.username} size={40} url={u.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "14px" }}>{u.first_name || "—"} {u.last_name || ""}</div>
                          <div style={{ fontSize: "12px", color: colors.goldDark }}>@{u.username || "—"}</div>
                          {u.created_at && (
                            <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "2px" }}>
                              Регистрация: {new Date(u.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "200px", justifyContent: "flex-end" }}>
                          {displayRoles.map((role, i) => (
                            <Badge key={i} variant={role.variant}>{role.label}</Badge>
                          ))}
                        </div>
                        <button onClick={() => startEditUser(u)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }}>
                          <Icons.Edit />
                        </button>
                        <button onClick={() => onDeleteUser(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }}>
                          <Icons.X />
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {/* Teams tab - ИСПРАВЛЕННЫЙ */}
          {tab === "teams" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Управление командами ({teams.length})</h3>
                <Button onClick={() => setShowCreateTeam(true)} style={{ padding: "8px 16px", fontSize: "13px" }}>
                  <Icons.Plus /> Создать команду
                </Button>
              </div>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Создавайте команды, назначайте тренеров и редактируйте информацию.
              </p>

              {showCreateTeam && (
                <Card style={{ marginBottom: "16px", background: "#f0fdf4", border: "2px solid #16a34a" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#16a34a" }}>Новая команда</h4>
                  <Input 
                    label="Название команды" 
                    value={newTeam.name} 
                    onChange={v => setNewTeam(p => ({ ...p, name: v }))} 
                    placeholder="Например: Амур Rockets"
                  />
                  
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: colors.text, display: "block", marginBottom: "6px" }}>
                      Логотип команды
                    </label>
                    
                    {newTeam.logo_url && (
                      <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                        {newTeam.logo_url.startsWith('http') ? (
                          <img src={newTeam.logo_url} alt="Логотип" style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px" }} />
                        ) : (
                          <div style={{ width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", background: colors.goldLight, borderRadius: "8px" }}>
                            {newTeam.logo_url}
                          </div>
                        )}
                        <button 
                          onClick={() => setNewTeam(p => ({ ...p, logo_url: "" }))}
                          style={{ padding: "4px 8px", fontSize: "12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                    
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input 
                        type="file" 
                        accept="image/*"
                        id="new-team-logo-upload"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleUploadTeamLogo(file);
                            if (url) {
                              setNewTeam(p => ({ ...p, logo_url: url }));
                            }
                          }
                        }}
                      />
                      <label 
                        htmlFor="new-team-logo-upload"
                        style={{ 
                          padding: "8px 12px", 
                          fontSize: "13px", 
                          background: colors.gold, 
                          color: "white", 
                          borderRadius: "6px", 
                          cursor: uploadingLogo ? "not-allowed" : "pointer",
                          opacity: uploadingLogo ? 0.5 : 1,
                          display: "inline-block"
                        }}
                      >
                        {uploadingLogo ? "Загрузка..." : "📁 Загрузить изображение"}
                      </label>
                      
                      <span style={{ fontSize: "12px", color: colors.goldDark }}>или</span>
                      
                      <Input 
                        value={newTeam.logo_url.startsWith('http') ? '' : newTeam.logo_url} 
                        onChange={v => setNewTeam(p => ({ ...p, logo_url: v }))} 
                        placeholder="🏐 введите эмодзи"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                    <Button 
                      onClick={async () => {
                        if (!newTeam.name.trim()) {
                          alert("Введите название команды");
                          return;
                        }
                        await onCreateTeam(newTeam);
                        setNewTeam({ name: "", logo_url: "" });
                        setShowCreateTeam(false);
                      }} 
                      disabled={actionLoading || uploadingLogo || !newTeam.name.trim()} 
                      style={{ flex: 1, padding: "10px" }}
                    >
                      <Icons.Save /> Создать
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setNewTeam({ name: "", logo_url: "" });
                        setShowCreateTeam(false);
                      }} 
                      style={{ flex: 1, padding: "10px" }}
                    >
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}
              {teams.map(team => {
                const coach = users.find(u => u.id === team.coach_id);
                const isEditing = editingTeam?.id === team.id;
                const isExpanded = expandedTeam === team.id;
                const teamPlayers = (players || []).filter(p => p.team_id === team.id);
                
                return (
                  <Card key={team.id} style={{ marginBottom: "8px", padding: "12px" }}>
                    {editingTeamInfo?.id === team.id ? (
                      <div>
                        <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>Редактирование информации</h4>
                        <Input 
                          label="Название команды" 
                          value={teamInfo.name} 
                          onChange={v => setTeamInfo(p => ({ ...p, name: v }))} 
                        />
                        
                        <div style={{ marginTop: "12px" }}>
                          <label style={{ fontSize: "13px", fontWeight: 500, color: colors.text, display: "block", marginBottom: "6px" }}>
                            Логотип команды
                          </label>
                          
                          {teamInfo.logo_url && (
                            <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                              {teamInfo.logo_url.startsWith('http') ? (
                                <img src={teamInfo.logo_url} alt="Логотип" style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px" }} />
                              ) : (
                                <div style={{ width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", background: colors.goldLight, borderRadius: "8px" }}>
                                  {teamInfo.logo_url}
                                </div>
                              )}
                              <button 
                                onClick={() => setTeamInfo(p => ({ ...p, logo_url: "" }))}
                                style={{ padding: "4px 8px", fontSize: "12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "4px", cursor: "pointer" }}
                              >
                                Удалить
                              </button>
                            </div>
                          )}
                          
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input 
                              type="file" 
                              accept="image/*"
                              id={`edit-team-logo-${team.id}`}
                              style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const url = await handleUploadTeamLogo(file);
                                  if (url) {
                                    setTeamInfo(p => ({ ...p, logo_url: url }));
                                  }
                                }
                              }}
                            />
                            <label 
                              htmlFor={`edit-team-logo-${team.id}`}
                              style={{ 
                                padding: "8px 12px", 
                                fontSize: "13px", 
                                background: colors.gold, 
                                color: "white", 
                                borderRadius: "6px", 
                                cursor: uploadingLogo ? "not-allowed" : "pointer",
                                opacity: uploadingLogo ? 0.5 : 1,
                                display: "inline-block"
                              }}
                            >
                              {uploadingLogo ? "Загрузка..." : "📁 Загрузить"}
                            </label>
                            
                            <span style={{ fontSize: "12px", color: colors.goldDark }}>или</span>
                            
                            <Input 
                              value={teamInfo.logo_url.startsWith('http') ? '' : teamInfo.logo_url} 
                              onChange={v => setTeamInfo(p => ({ ...p, logo_url: v }))} 
                              placeholder="🏐 эмодзи"
                              style={{ flex: 1 }}
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                          <Button 
                            onClick={async () => {
                              if (!teamInfo.name.trim()) {
                                alert("Введите название команды");
                                return;
                              }
                              await onUpdateTeamInfo(editingTeamInfo.id, teamInfo);
                              setEditingTeamInfo(null);
                            }} 
                            disabled={actionLoading || uploadingLogo || !teamInfo.name.trim()} 
                            style={{ flex: 1, padding: "10px" }}
                          >
                            <Icons.Save /> Сохранить
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setEditingTeamInfo(null)} 
                            style={{ flex: 1, padding: "10px" }}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : isEditing ? (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "12px" }}>{team.name}</div>
                        <div style={{ marginBottom: "12px" }}>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "6px" }}>Поиск и выбор тренера</label>
                          <input
                            type="text"
                            value={coachSearchQuery}
                            onChange={e => setCoachSearchQuery(e.target.value)}
                            onFocus={() => setIsCoachListOpen(true)}
                            placeholder="Введите имя тренера..."
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: "8px",
                              border: `1px solid ${colors.grayBorder}`,
                              fontSize: "14px",
                              outline: "none",
                              boxSizing: "border-box",
                              marginBottom: "8px"
                            }}
                          />
                          
                          {/* Выбранный тренер */}
                          {teamCoach && (() => {
                            const selected = users?.find(u => u.id === teamCoach);
                            return selected ? (
                              <div style={{ 
                                padding: "8px 12px", 
                                background: colors.goldLight, 
                                borderRadius: "6px", 
                                fontSize: "13px",
                                marginBottom: "8px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                              }}>
                                <span>✓ {`${selected.first_name || selected.username || "—"} ${selected.last_name || ""}`.trim()}</span>
                                <button 
                                  onClick={() => setTeamCoach("")}
                                  style={{ 
                                    background: "none", 
                                    border: "none", 
                                    color: colors.gold, 
                                    cursor: "pointer",
                                    fontSize: "16px",
                                    padding: "0 4px"
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : null;
                          })()}
                          
                          {/* Список тренеров */}
                          {isCoachListOpen && (
                            <div style={{ position: "relative" }}>
                              <div 
                                style={{ 
                                  position: "fixed", 
                                  top: 0, 
                                  left: 0, 
                                  right: 0, 
                                  bottom: 0, 
                                  zIndex: 999 
                                }}
                                onClick={() => setIsCoachListOpen(false)}
                              />
                              <div style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                background: "#fff",
                                border: `1px solid ${colors.grayBorder}`,
                                borderRadius: "8px",
                                maxHeight: "300px",
                                overflowY: "auto",
                                zIndex: 1000,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                              }}>
                                {(() => {
                                  const filteredUsers = [
                                    { id: "", name: "Не назначен" },
                                    ...(users || [])
                                      .filter(u => {
                                        if (!coachSearchQuery) return true;
                                        const query = coachSearchQuery.toLowerCase();
                                        const name = `${u.first_name || ""} ${u.last_name || ""} ${u.username || ""}`.toLowerCase();
                                        return name.includes(query);
                                      })
                                      .map(u => ({
                                        id: u.id,
                                        name: `${u.first_name || u.username || "—"} ${u.last_name || ""}`.trim()
                                      }))
                                  ];
                                  
                                  if (filteredUsers.length === 1) {
                                    return (
                                      <div style={{ padding: "12px", color: colors.goldDark, textAlign: "center" }}>
                                        Нет результатов
                                      </div>
                                    );
                                  }
                                  
                                  return filteredUsers.map(user => (
                                    <div
                                      key={user.id}
                                      onClick={() => {
                                        setTeamCoach(user.id);
                                        setIsCoachListOpen(false);
                                        setCoachSearchQuery("");
                                      }}
                                      style={{
                                        padding: "10px 12px",
                                        cursor: "pointer",
                                        background: user.id === teamCoach ? colors.goldLight : "#fff",
                                        borderBottom: `1px solid ${colors.grayBorder}`,
                                        fontSize: "14px"
                                      }}
                                    >
                                      {user.name}
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                          <Button onClick={saveTeam} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                            <Icons.Save /> Сохранить
                          </Button>
                          <Button variant="outline" onClick={() => { setEditingTeam(null); setCoachSearchQuery(""); setIsCoachListOpen(false); }} style={{ flex: 1, padding: "10px" }}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "40px", height: "40px", background: colors.goldLight, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", overflow: "hidden" }}>
                            {team.logo_url && team.logo_url.startsWith('http') ? (
                              <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              team.logo_url || "🏐"
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "14px" }}>{team.name}</div>
                            <div style={{ fontSize: "12px", color: colors.goldDark }}>
                              Тренер: {coach ? `${coach.first_name || coach.username} ${coach.last_name || ""}`.trim() : "Не назначен"} • {teamPlayers.length} игроков
                            </div>
                          </div>
                          <button 
                            onClick={() => toggleTeamExpand(team.id)} 
                            style={{ background: "none", border: "none", cursor: "pointer", color: colors.goldDark, padding: "4px", transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}
                          >
                            <Icons.ChevronRight />
                          </button>
                          <button 
                            onClick={() => {
                              setEditingTeamInfo(team);
                              setTeamInfo({ name: team.name, logo_url: team.logo_url || "" });
                            }} 
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", padding: "4px" }} 
                            title="Редактировать название и логотип"
                          >
                            ℹ️
                          </button>
                          <button onClick={() => startEditTeam(team)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }} title="Назначить тренера">
                            <Icons.Edit />
                          </button>
                          <button onClick={() => onDeleteTeam(team.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }} title="Удалить команду">
                            <Icons.X />
                          </button>
                        </div>
                        
                        {isExpanded && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colors.grayBorder}` }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>Состав команды:</div>
                            {teamPlayers.length > 0 ? teamPlayers.map(player => (
                              <div key={player.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                                {editingPlayer?.id === player.id ? (
                                  <div style={{ background: colors.gray, padding: "12px", borderRadius: "8px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                      <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
                                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{player.users?.first_name || player.users?.username}</span>
                                    </div>
                                    <div style={{ marginBottom: "8px" }}>
                                      <label style={{ fontSize: "12px", color: colors.goldDark }}>Номер:</label>
                                      <input type="number" min="1" max="99" value={playerJersey} onChange={e => setPlayerJersey(e.target.value)} style={{ width: "60px", marginLeft: "8px", padding: "4px 8px", borderRadius: "4px", border: `1px solid ${colors.grayBorder}` }} />
                                    </div>
                                    <div style={{ marginBottom: "8px" }}>
                                      <label style={{ fontSize: "12px", color: colors.goldDark, display: "block", marginBottom: "4px" }}>Амплуа:</label>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                        {["setter", "opposite", "outside", "middle", "libero"].map(pos => (
                                          <button key={pos} onClick={() => togglePosition(pos)} style={{ padding: "4px 8px", borderRadius: "12px", border: "none", fontSize: "11px", cursor: "pointer", background: playerPositions.includes(pos) ? colors.gold : colors.grayBorder, color: playerPositions.includes(pos) ? "white" : colors.text }}>{positionLabels[pos]}</button>
                                        ))}
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <button onClick={savePlayer} style={{ flex: 1, padding: "6px", background: colors.gold, color: "white", border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>Сохранить</button>
                                      <button onClick={() => setEditingPlayer(null)} style={{ flex: 1, padding: "6px", background: colors.grayBorder, border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>Отмена</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
                                    <span style={{ fontSize: "13px", flex: 1 }}>{player.users?.first_name || player.users?.username}{player.is_captain && <span style={{ marginLeft: "4px", color: colors.gold }}>©</span>}</span>
                                    <span style={{ fontSize: "11px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ") || "—"}</span>
                                    {player.jersey_number && <span style={{ fontSize: "12px", fontWeight: 600, color: colors.gold }}>#{player.jersey_number}</span>}
                                    <button onClick={() => startEditPlayer(player)} style={{ background: "#e0f2fe", border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", cursor: "pointer", color: "#0284c7" }}>✏️</button>
                                    <button onClick={() => onSetCaptain(team.id, player.id, !player.is_captain)} style={{ background: player.is_captain ? "#f3e8ff" : colors.gray, border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", cursor: "pointer", color: player.is_captain ? "#7c3aed" : colors.goldDark }}>{player.is_captain ? "©" : "Кап"}</button>
                                  </div>
                                )}
                              </div>
                            )) : (
                              <div style={{ fontSize: "13px", color: colors.goldDark, fontStyle: "italic" }}>Нет игроков</div>
                            )}
                            {/* Массовая рассылка команде */}
                            <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${colors.grayBorder}` }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>📢 Отправить сообщение команде:</div>
                              <textarea
                                value={teamMessage}
                                onChange={e => setTeamMessage(e.target.value)}
                                placeholder="Введите сообщение для всех игроков команды..."
                                style={{ 
                                  width: "100%", 
                                  minHeight: "60px", 
                                  padding: "10px", 
                                  borderRadius: "8px", 
                                  border: `1px solid ${colors.grayBorder}`,
                                  fontSize: "13px",
                                  resize: "vertical",
                                  boxSizing: "border-box"
                                }}
                              />
                              <Button 
                                onClick={async () => {
                                  if (!teamMessage.trim()) {
                                    alert("Введите сообщение");
                                    return;
                                  }
                                  const result = await sendTeamMessage(team.id, team.name, teamMessage, "Администратор");
                                  setTeamMessage("");
                                  alert(`Сообщение отправлено: ${result.sent} из ${result.usersFound || 0}`);
                                }}
                                style={{ marginTop: "8px", width: "100%", padding: "10px" }}
                                disabled={!teamMessage.trim()}
                              >
                                <Icons.Send /> Отправить всем ({teamPlayers.length})
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {/* Predictions tab */}
          {tab === "predictions" && (
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 16px" }}>Система прогнозов</h3>
              
              {/* Спонсоры */}
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Спонсоры ({(sponsors || []).length})</h4>
                  <Button onClick={() => setShowAddSponsor(true)} style={{ padding: "6px 12px", fontSize: "12px" }}>+ Добавить</Button>
                </div>
                
                {showAddSponsor && (
                  <div style={{ background: colors.goldLight, padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                    <Input label="Название" value={newSponsor.name} onChange={v => setNewSponsor(p => ({ ...p, name: v }))} placeholder="Название спонсора" />
                    <div style={{ marginTop: "8px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: colors.goldDark }}>Логотип</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            const url = await handleUploadSponsorLogo(file);
                            if (url) setNewSponsor(p => ({ ...p, logo_url: url }));
                          }
                        }}
                        style={{ fontSize: "13px" }}
                      />
                      {uploadingSponsorLogo && <span style={{ fontSize: "12px", color: colors.goldDark, marginLeft: "8px" }}>Загрузка...</span>}
                      {newSponsor.logo_url && <span style={{ fontSize: "12px", color: "green", marginLeft: "8px" }}>✓</span>}
                    </div>
                    <Input label="Описание" value={newSponsor.description} onChange={v => setNewSponsor(p => ({ ...p, description: v }))} placeholder="Описание" style={{ marginTop: "8px" }} />
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <Button onClick={handleCreateSponsor} disabled={!newSponsor.name || uploadingSponsorLogo}>Сохранить</Button>
                      <Button variant="outline" onClick={() => { setShowAddSponsor(false); setNewSponsor({ name: "", logo_url: "", description: "" }); }}>Отмена</Button>
                    </div>
                  </div>
                )}
                
                {(sponsors || []).length === 0 ? (
                  <p style={{ color: colors.goldDark, fontSize: "13px" }}>Спонсоры не добавлены</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(sponsors || []).map(s => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", background: colors.gray, borderRadius: "8px" }}>
                        {s.logo_url ? <img src={s.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: "8px", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /> : null}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "14px" }}>{s.name || "Без названия"}</div>
                          <div style={{ fontSize: "12px", color: colors.goldDark }}>{s.description || ""}</div>
                        </div>
                        <button onClick={() => handleDeleteSponsor(s.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              
              {/* Призы */}
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Призы ({(prizes || []).length})</h4>
                  <Button onClick={() => setShowAddPrize(true)} style={{ padding: "6px 12px", fontSize: "12px" }} disabled={(sponsors || []).length === 0}>+ Добавить</Button>
                </div>
                
                {(sponsors || []).length === 0 && <p style={{ color: colors.goldDark, fontSize: "13px" }}>Сначала добавьте спонсора</p>}
                
                {showAddPrize && (
                  <div style={{ background: colors.goldLight, padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                    <Select label="Спонсор" value={newPrize.sponsor_id} onChange={v => setNewPrize(p => ({ ...p, sponsor_id: v }))}
                      options={[{ value: "", label: "Выберите спонсора" }].concat((sponsors || []).map(s => ({ value: s.id, label: s.name })))} />
                    <Input label="Название приза" value={newPrize.title} onChange={v => setNewPrize(p => ({ ...p, title: v }))} placeholder="Сертификат на 1000₽" style={{ marginTop: "8px" }} />
                    <Input label="Описание" value={newPrize.description} onChange={v => setNewPrize(p => ({ ...p, description: v }))} placeholder="Описание" style={{ marginTop: "8px" }} />
                    <Select label="За какое место" value={newPrize.place} onChange={v => setNewPrize(p => ({ ...p, place: v }))} style={{ marginTop: "8px" }}
                      options={[{ value: "1", label: "1 место" }, { value: "2", label: "2 место" }, { value: "3", label: "3 место" }]} />
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <Button onClick={handleCreatePrize} disabled={!newPrize.sponsor_id || !newPrize.title}>Сохранить</Button>
                      <Button variant="outline" onClick={() => { setShowAddPrize(false); setNewPrize({ sponsor_id: "", title: "", description: "", place: "1", tour_id: "" }); }}>Отмена</Button>
                    </div>
                  </div>
                )}
                
                {(prizes || []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(prizes || []).map(p => {
                      const sponsor = (sponsors || []).find(s => s.id === p.sponsor_id);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", background: colors.gray, borderRadius: "8px" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "14px" }}>{p.title}</div>
                            <div style={{ fontSize: "12px", color: colors.goldDark }}>{sponsor ? sponsor.name : "?"} • {p.place} место</div>
                          </div>
                          <button onClick={() => handleDeletePrize(p.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px" }}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
              
              {/* Таблица лидеров */}
              <Card>
                <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Таблица лидеров ({(predictions || []).length} прогнозов)</h4>
                {(predictions || []).length === 0 ? (
                  <p style={{ color: colors.goldDark, fontSize: "13px" }}>Пока нет прогнозов</p>
                ) : (
                  <div>
                    {Object.entries((predictions || []).reduce((acc, p) => {
                      acc[p.user_id] = (acc[p.user_id] || 0) + (p.points_earned || 0);
                      return acc;
                    }, {}))
                      .map(([id, pts]) => {
                        const u = (users || []).find(x => x.id === id);
                        return u ? { user: u, points: pts } : null;
                      })
                      .filter(Boolean)
                      .sort((a, b) => b.points - a.points)
                      .slice(0, 10)
                      .map((item, i) => (
                        <div key={item.user.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < 9 ? "1px solid #eee" : "none" }}>
                          <div style={{ width: 24, textAlign: "center", fontWeight: 700 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>{item.user.first_name} {item.user.last_name || ""}</div>
                          <div style={{ fontWeight: 700, color: colors.gold }}>{item.points}</div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};
// Модальное окно формы заявки на роль
