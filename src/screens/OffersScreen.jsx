import { } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const OffersScreen = ({ setScreen, offers, teams, onAccept, onReject, loading, isInTeam }) => {
  const pendingOffers = offers.filter(o => o.status === "pending");
  const historyOffers = offers.filter(o => o.status !== "pending");

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Приглашения" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {pendingOffers.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Новые приглашения ({pendingOffers.length})</h3>
              {pendingOffers.map(offer => {
                const team = teams.find(t => t.id === offer.team_id);
                return (
                  <Card key={offer.id} style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                      <div style={{ width: "48px", height: "48px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", overflow: "hidden" }}>
                        {team?.logo_url && team.logo_url.startsWith('http') ? (
                          <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          team?.logo_url || "🏐"
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "15px" }}>{team?.name || "Команда"}</div>
                        <div style={{ fontSize: "13px", color: colors.goldDark }}>Приглашает вас в состав</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "2px" }}>{new Date(offer.created_at).toLocaleDateString("ru-RU")}</div>
                      </div>
                    </div>
                    {isInTeam ? (
                      <div style={{ background: colors.gray, padding: "12px", borderRadius: "8px", textAlign: "center", fontSize: "13px", color: colors.goldDark }}>
                        Вы уже в команде. Чтобы принять приглашение, сначала покиньте текущую команду.
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button variant="success" onClick={() => onAccept(offer.id, offer.team_id)} disabled={loading} style={{ flex: 1, padding: "10px" }}><Icons.Check /> Принять</Button>
                        <Button variant="danger" onClick={() => onReject(offer.id)} disabled={loading} style={{ flex: 1, padding: "10px" }}><Icons.X /> Отклонить</Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}
          {pendingOffers.length === 0 && (
            <Card style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Нет новых приглашений</div>
              <div style={{ fontSize: "13px", color: colors.goldDark }}>Когда команда пригласит вас, вы увидите это здесь</div>
            </Card>
          )}
          {historyOffers.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "24px 0 12px" }}>История</h3>
              {historyOffers.map(offer => {
                const team = teams.find(t => t.id === offer.team_id);
                return (
                  <Card key={offer.id} style={{ marginBottom: "8px", padding: "12px 16px", opacity: 0.7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "40px", height: "40px", background: colors.gray, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", overflow: "hidden" }}>
                          {team?.logo_url && team.logo_url.startsWith('http') ? (
                            <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            team?.logo_url || "🏐"
                          )}
                        </div>                    
                          <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: "14px" }}>{team?.name || "Команда"}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>{new Date(offer.created_at).toLocaleDateString("ru-RU")}</div>
                      </div>
                      <Badge variant={offer.status === "accepted" ? "free" : "default"}>{offer.status === "accepted" ? "Принято" : "Отклонено"}</Badge>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </Container>
    </div>
  );
};

