import { } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const ScheduleScreen = ({ matches, teams, tours, isGuest, setSelectedTeam, setScreen }) => {
  const today = new Date();
  const sortedTours = [...tours].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const aIsUpcoming = dateA >= today;
    const bIsUpcoming = dateB >= today;
    
    if (aIsUpcoming && !bIsUpcoming) return -1;
    if (!aIsUpcoming && bIsUpcoming) return 1;
    if (aIsUpcoming && bIsUpcoming) return dateA - dateB;
    return dateB - dateA;
  });

  const matchesByTour = sortedTours.map(tour => ({
    tour,
    matches: (matches || [])
      .filter(m => m.tour_id === tour.id)
      .sort((a, b) => {
        // Сравниваем строки времени напрямую (формат ISO: "2025-12-28T13:00")
        if (!a.scheduled_time) return 1;
        if (!b.scheduled_time) return -1;
        return a.scheduled_time.localeCompare(b.scheduled_time);
      }),
  }));

  const handleTeamClick = (team) => {
    setSelectedTeam(team);
    setScreen("teamDetail");
  };

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Расписание" />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {matchesByTour.map(({ tour, matches: tourMatches }) => {
            const tourDate = new Date(tour.date);
            const isPast = tourDate < today;
            
            return (
              <div key={tour.id} style={{ marginBottom: "32px", opacity: isPast ? 0.7 : 1 }}>
                <div style={{ 
                  background: isPast ? colors.gray : colors.gold, 
                  color: isPast ? colors.text : colors.bg, 
                  padding: "12px 16px", 
                  borderRadius: "12px", 
                  marginBottom: "16px" 
                }}>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>
                    Тур {tour.number}
                    {isPast && <span style={{ fontSize: "12px", fontWeight: 400, marginLeft: "8px" }}>(завершён)</span>}
                  </div>
                  <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icons.Calendar />{new Date(tour.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </div>
                  <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icons.MapPin />{tour.location}, {tour.address}
                  </div>
                </div>
                {tourMatches.map(match => (
                  <Card key={match.id} style={{ marginBottom: "12px" }}>
                    <MatchCard match={match} teams={teams} onTeamClick={handleTeamClick} />
                    {match.status === "live" && match.stream_url && (
                      <Button onClick={() => window.open(match.stream_url, '_blank')} style={{ width: "100%", marginTop: "12px" }}>
                        <Icons.Play /> Трансляция
                      </Button>
                    )}
                    {match.status === "finished" && !isGuest && match.video_url && (
                      <Button variant="outline" onClick={() => window.open(match.video_url, '_blank')} style={{ width: "100%", marginTop: "12px" }}>
                        <Icons.Play /> Смотреть запись
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      </Container>
    </div>
  );
};

