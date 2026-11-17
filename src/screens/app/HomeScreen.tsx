import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDailyDashboard } from '../../api/dashboardApi';
import { getActiveWorkoutSession, getTodayWorkout } from '../../api/workoutApi';
import { VeyronDock } from '../../components/app/VeyronDock';
import { UserAccountDrawer } from '../../components/app/UserAccountDrawer';
import { UserAvatar } from '../../components/app/UserAvatar';
import {
  elevation,
  layout,
  omniColor,
  radius,
  typeScale,
} from '../../constants/designSystem';
import type { FitnessPalette } from '../../constants/fitnessPalette';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks';
import { useFitnessPalette, useFitnessStyles } from '../../hooks/useFitnessPalette';
import type { AppStackParamList, MainTabParamList } from '../../navigation/types';
import type { DailyDashboard } from '../../types/dashboard';
import type { WorkoutDay, WorkoutSession } from '../../types/fitness';

type HomeNavigation = NativeStackNavigationProp<AppStackParamList, 'Home'>;
type FitnessDestination = keyof MainTabParamList;
type FeedTab = 'modules' | 'live' | 'reorder';

type QuickModule = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destination?: FitnessDestination;
  featured?: boolean;
};

const QUICK_MODULES: QuickModule[] = [
  { id: 'fitness', label: 'Fitness', icon: 'barbell', destination: 'Analytics', featured: true },
  { id: 'nutrition', label: 'Nutrition', icon: 'restaurant', destination: 'Meals' },
  { id: 'todo', label: 'To-Do', icon: 'checkbox-outline' },
  { id: 'treasury', label: 'Treasury', icon: 'wallet-outline' },
  { id: 'habits', label: 'Habits', icon: 'repeat-outline' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline' },
  { id: 'breath', label: 'Breath', icon: 'leaf-outline' },
  { id: 'iot', label: 'Smart IoT', icon: 'hardware-chip-outline' },
];

const EXTENSIONS: QuickModule[] = [
  { id: 'sleep-ext', label: 'Sleep & Recovery', icon: 'moon-outline' },
  { id: 'breath-ext', label: 'Mind & Breath', icon: 'leaf-outline' },
  { id: 'habit-ext', label: 'Habit Matrix', icon: 'grid-outline' },
  { id: 'iot-ext', label: 'Smart IoT', icon: 'hardware-chip-outline' },
];

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function round(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? null : Math.round(value);
}

function formatElapsed(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${String(remain).padStart(2, '0')}s`;
}

function liters(ml: number) {
  return `${(ml / 1000).toFixed(1)}L`;
}

function sessionSeconds(session: WorkoutSession | null) {
  if (!session) return null;
  return (
    session.elapsedSeconds ??
    session.durationSeconds ??
    session.analytics?.elapsedSeconds ??
    session.analytics?.durationSeconds ??
    (session.durationMinutes != null ? session.durationMinutes * 60 : null) ??
    session.analytics?.durationMinutes ??
    null
  );
}

function burnedCalories(session: WorkoutSession | null) {
  return round(session?.caloriesBurned ?? session?.analytics?.caloriesBurned);
}

export function HomeScreen() {
  const p = useFitnessPalette();
  const styles = useFitnessStyles(buildStyles);
  const { resolvedTheme } = useTheme();
  const success = omniColor[resolvedTheme === 'dark' ? 'dark' : 'light'].success;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNavigation>();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [feed, setFeed] = useState<FeedTab>('modules');
  const [dashboard, setDashboard] = useState<DailyDashboard | null>(null);
  const [today, setToday] = useState<WorkoutDay | null>(null);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [dash, day, active] = await Promise.all([
      getDailyDashboard().catch(() => null),
      getTodayWorkout().catch(() => null),
      getActiveWorkoutSession().catch(() => null),
    ]);
    setDashboard(dash);
    setToday(day);
    setSession(active);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openFitness = (screen: FitnessDestination) => {
    navigation.navigate('MainTabs', { screen });
  };

  const firstName = useMemo(() => {
    const name = user?.name?.trim();
    if (name) return name.split(/\s+/)[0] || name;
    const email = user?.email?.trim();
    if (email?.includes('@')) return email.split('@')[0] || 'there';
    return 'there';
  }, [user?.email, user?.name]);

  const connected = QUICK_MODULES.filter((item) => item.destination).length;
  const score = round(dashboard?.todayScore);
  const tasks = dashboard?.tasks ?? [];
  const tasksDone = tasks.filter((task) => task.done).length;
  const caloriesCurrent = round(dashboard?.calories.current);
  const caloriesGoal = round(dashboard?.calories.goal);
  const caloriesLeft = round(dashboard?.calories.remaining ?? dashboard?.remainingCalories);
  const caloriePercent = Math.max(0, Math.min(100, dashboard?.calories.percent ?? 0));
  const proteinCurrent = round(dashboard?.protein.current);
  const proteinGoal = round(dashboard?.protein.goal);
  const proteinPercent = Math.max(0, Math.min(100, dashboard?.protein.percent ?? 0));
  const waterCurrent = dashboard?.water.currentMl;
  const waterGoal = dashboard?.water.goalMl;
  const waterPercent = Math.max(0, Math.min(100, dashboard?.water.percent ?? 0));

  const exerciseTotal =
    session?.exercisesTotal ??
    session?.analytics?.exercisesTotal ??
    today?.exercises.length ??
    0;
  const exerciseDone =
    session?.exercisesCompleted ??
    session?.analytics?.exercisesCompleted ??
    today?.exercises.filter((exercise) => exercise.completed).length ??
    0;
  const elapsed = sessionSeconds(session);
  const burned = burnedCalories(session);
  const taskPercent = tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : null;
  const sessionLive = session?.status === 'active' || session?.status === 'paused';
  const workoutDone = dashboard?.workout.completed === true || session?.status === 'finished';
  const workoutName = today?.focus?.trim() || today?.label?.trim() || 'Today’s workout';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: layout.dockClearance + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={p.lime}
            onRefresh={() => {
              setRefreshing(true);
              const started = Date.now();
              void load().finally(() => {
                const wait = Math.max(0, 400 - (Date.now() - started));
                setTimeout(() => setRefreshing(false), wait);
              });
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('../../../assets/icon.png')} style={styles.logo} />
            <Text style={styles.brandName}>Veyron</Text>
            <Text style={styles.brandAdaptive}>Adaptive</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => scrollRef.current?.scrollTo({ y: 220, animated: true })}
              style={styles.iconBtn}
            >
              <Ionicons color={p.text} name="grid-outline" size={18} />
            </Pressable>
            <View style={styles.iconBtn}>
              <Ionicons color={p.textMuted} name="notifications-outline" size={18} />
            </View>
            <Pressable accessibilityRole="button" onPress={() => setAccountOpen(true)}>
              <UserAvatar avatar={user?.avatar} email={user?.email} size={32} />
            </Pressable>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLeft}>Personal Workspace • Synchronized</Text>
          <Text style={styles.statusRight}>{score != null ? `${score}%` : '—'}</Text>
        </View>

        <Text style={styles.greeting}>
          {greeting(new Date())}, {firstName}
        </Text>
        <Text style={styles.greetingSub}>
          {connected} orchestrated modules running in rhythm
        </Text>

        <View style={styles.sectionHead}>
          <Text style={styles.kicker}>Quick access modules</Text>
          <Text style={styles.linkText}>{connected} Connected</Text>
        </View>
        <ScrollView
          horizontal
          contentContainerStyle={styles.quickRow}
          showsHorizontalScrollIndicator={false}
        >
          {QUICK_MODULES.map((item) => {
            const live = Boolean(item.destination);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: !live }}
                disabled={!live}
                onPress={() => item.destination && openFitness(item.destination)}
                style={styles.quickItem}
              >
                <View
                  style={[
                    styles.quickIcon,
                    item.featured && styles.quickIconOn,
                    !live && styles.quickIconSoon,
                  ]}
                >
                  <Ionicons
                    color={item.featured ? p.onLime : live ? p.lime : p.textMuted}
                    name={item.icon}
                    size={20}
                  />
                </View>
                <Text style={[styles.quickLabel, !live && styles.quickLabelSoon]}>{item.label}</Text>
                <Text style={styles.quickSoon}>{live ? ' ' : 'Upcoming'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.card}>
          <View style={styles.vitalHead}>
            <View style={styles.vitalMark}>
              <Ionicons color={p.lime} name="stats-chart" size={18} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Daily Vitals & Cadence</Text>
              <Text style={styles.cardMeta}>Systemic balance overview</Text>
            </View>
            <View style={[styles.trackPill, { backgroundColor: `${success}22` }]}>
              <View style={[styles.trackDot, { backgroundColor: success }]} />
              <Text style={[styles.pillText, { color: success }]}>
                {score != null ? `On track  ${score}%` : 'Upcoming'}
              </Text>
            </View>
          </View>
          <View style={styles.vitalGrid}>
            <View style={styles.vitalRow}>
              <VitalTile
                barColor={p.burn}
                icon="flame"
                iconColor={p.burn}
                label="Active burn"
                percent={null}
                unit={burned != null ? 'kcal' : undefined}
                value={burned != null ? `${burned}` : 'Upcoming'}
              />
              <VitalTile
                barColor={p.lime}
                icon="checkmark-circle"
                iconColor={p.lime}
                label="Tasks done"
                meta={taskPercent != null ? `${taskPercent}%` : undefined}
                metaColor={p.lime}
                percent={taskPercent}
                unit={dashboard ? `of ${tasks.length}` : undefined}
                value={dashboard ? `${tasksDone}` : 'Upcoming'}
              />
            </View>
            <View style={styles.vitalRow}>
              <VitalTile
                barColor={p.textSecondary}
                icon="wallet-outline"
                iconColor={p.textSecondary}
                label="Spend cap"
                value="Upcoming"
              />
              <VitalTile
                barColor={p.lime}
                icon="pulse"
                iconColor={p.lime}
                label="Recovery"
                value="Upcoming"
              />
            </View>
          </View>
        </View>

        <View style={styles.feedHead}>
          {(
            [
              ['modules', 'Active modules'],
              ['live', 'Live feed'],
              ['reorder', 'Reorder'],
            ] as const
          ).map(([id, label]) => {
            const selected = feed === id;
            return (
              <Pressable key={id} onPress={() => setFeed(id)} style={styles.feedTab}>
                <Text style={[styles.feedLabel, selected && styles.feedLabelOn]}>{label}</Text>
                {selected ? <View style={styles.feedBar} /> : null}
              </Pressable>
            );
          })}
        </View>

        {feed === 'modules' ? (
          <View style={styles.stack}>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.kicker}>Fitness engine</Text>
                <View style={[styles.pill, { backgroundColor: `${success}22` }]}>
                  <Text style={[styles.pillText, { color: success }]}>
                    {sessionLive ? 'In progress' : workoutDone ? 'Done' : 'Ready'}
                  </Text>
                </View>
              </View>
              <Text style={styles.moduleTitle}>{workoutName}</Text>
              <Text style={styles.cardMeta}>
                {exerciseTotal > 0
                  ? `${exerciseDone} of ${exerciseTotal} exercises completed`
                  : 'Workout details upcoming'}
              </Text>
              <View style={styles.metricRow}>
                <Metric icon="time-outline" label="Elapsed" value={elapsed != null ? formatElapsed(elapsed) : '—'} />
                <Metric icon="heart-outline" label="Heart" value="Upcoming" />
                <Metric
                  icon="flame-outline"
                  label="Burned"
                  value={burned != null ? `${burned} kcal` : '—'}
                />
              </View>
              <View style={styles.actionRow}>
                <Pressable onPress={() => openFitness('Workout')} style={styles.primaryBtn}>
                  <Ionicons color={p.onLime} name="play" size={14} />
                  <Text style={styles.primaryText}>
                    {sessionLive ? 'Resume workout' : 'Open workout'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Open workout"
                  onPress={() => openFitness('Workout')}
                  style={styles.moreBtn}
                >
                  <Ionicons color={p.textSecondary} name="ellipsis-horizontal" size={18} />
                </Pressable>
              </View>
            </View>

            <Pressable onPress={() => openFitness('Meals')} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.kicker}>Fuel & nutrition</Text>
                <View style={[styles.pill, styles.pillBlue]}>
                  <Text style={[styles.pillText, styles.pillTextBlue]}>Log meal</Text>
                </View>
              </View>
              <View style={styles.split}>
                <View style={styles.cardCopy}>
                  <Text style={styles.moduleTitle}>Daily metabolic budget</Text>
                  <Text style={styles.cardMeta}>
                    {caloriesLeft != null ? `${caloriesLeft} kcal remaining today` : 'Upcoming'}
                  </Text>
                </View>
                <View style={styles.budget}>
                  <Text style={styles.budgetNow}>
                    {caloriesCurrent != null ? caloriesCurrent.toLocaleString() : '—'}
                  </Text>
                  <Text style={styles.budgetGoal}>
                    {caloriesGoal != null ? `/ ${caloriesGoal.toLocaleString()}` : 'Upcoming'}
                  </Text>
                </View>
              </View>
              <View style={styles.macroRow}>
                <Macro
                  label="Protein"
                  current={proteinCurrent != null ? `${proteinCurrent}g` : '—'}
                  target={proteinGoal != null ? `${proteinGoal}g` : 'Upcoming'}
                  percent={proteinPercent}
                />
                <Macro
                  label="Hydration"
                  current={waterCurrent != null ? liters(waterCurrent) : '—'}
                  target={waterGoal != null ? liters(waterGoal) : 'Upcoming'}
                  percent={waterPercent}
                />
              </View>
            </Pressable>

            <UpcomingCard
              kicker="Execution sprint"
              title="Deep work"
              detail="Focus blocks are upcoming"
            />
            <UpcomingCard
              kicker="Treasury & runway"
              title="Daily discretionary cap"
              detail="Spending and runway are upcoming"
            />

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardCopy}>
                  <Text style={styles.moduleTitle}>Add pluggable extension</Text>
                  <Text style={styles.cardMeta}>
                    Wearables, breathwork, and home devices are upcoming
                  </Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Upcoming</Text>
                </View>
              </View>
              <View style={styles.extensionGrid}>
                {EXTENSIONS.map((item) => (
                  <View key={item.id} style={styles.extension}>
                    <Ionicons color={p.textMuted} name={item.icon} size={16} />
                    <Text style={styles.extensionLabel}>{item.label}</Text>
                    <Text style={styles.quickSoon}>Upcoming</Text>
                  </View>
                ))}
              </View>
              <View style={styles.upcomingBtn}>
                <Text style={styles.upcomingBtnText}>Module marketplace upcoming</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.moduleTitle}>
              {feed === 'live' ? 'Live feed' : 'Reorder'}
            </Text>
            <Text style={styles.cardMeta}>
              {feed === 'live' ? 'The live feed is upcoming' : 'Reordering modules is upcoming'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.dockWrap, { bottom: Math.max(insets.bottom, 10) }]}>
        <VeyronDock
          onHome={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          slots={[
            { label: 'Analytics', icon: 'stats-chart-outline', soon: true },
            { label: 'History', icon: 'time-outline', soon: true },
            { label: 'Smart', icon: 'sparkles-outline', soon: true },
            {
              label: 'Profile',
              icon: 'person-outline',
              onPress: () => setAccountOpen(true),
            },
          ]}
        />
      </View>

      <UserAccountDrawer visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}

function VitalTile({
  icon,
  iconColor,
  label,
  meta,
  metaColor,
  value,
  unit,
  percent,
  barColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  meta?: string;
  metaColor?: string;
  value: string;
  unit?: string;
  percent?: number | null;
  barColor: string;
}) {
  const styles = useFitnessStyles(buildStyles);
  const upcoming = value === 'Upcoming';
  return (
    <View style={styles.vitalTile}>
      <View style={styles.vitalTop}>
        <Ionicons color={iconColor} name={icon} size={14} />
        <Text numberOfLines={1} style={styles.vitalLabel}>{label}</Text>
        {meta ? <Text style={[styles.vitalMeta, { color: metaColor ?? iconColor }]}>{meta}</Text> : null}
      </View>
      <View style={styles.vitalFigure}>
        <Text numberOfLines={1} style={[styles.vitalValue, upcoming && styles.upcomingValue]}>
          {value}
        </Text>
        {unit ? <Text style={styles.vitalUnit}>{unit}</Text> : null}
      </View>
      <View style={styles.vitalTrack}>
        <View
          style={[
            styles.vitalFill,
            {
              backgroundColor: barColor,
              width: `${Math.max(0, Math.min(100, percent ?? 0))}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const p = useFitnessPalette();
  const styles = useFitnessStyles(buildStyles);
  return (
    <View style={styles.metric}>
      <Ionicons color={p.lime} name={icon} size={14} />
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={[styles.metricValue, value === 'Upcoming' && styles.upcomingValue]}>{value}</Text>
    </View>
  );
}

function Macro({
  label,
  current,
  target,
  percent,
}: {
  label: string;
  current: string;
  target: string;
  percent: number;
}) {
  const styles = useFitnessStyles(buildStyles);
  return (
    <View style={styles.macro}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={styles.metricValue}>{current}</Text>
      <Text style={styles.cardMeta}>Target {target}</Text>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function UpcomingCard({
  kicker,
  title,
  detail,
}: {
  kicker: string;
  title: string;
  detail: string;
}) {
  const styles = useFitnessStyles(buildStyles);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.kicker}>{kicker}</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Upcoming</Text>
        </View>
      </View>
      <Text style={styles.moduleTitle}>{title}</Text>
      <Text style={styles.cardMeta}>{detail}</Text>
    </View>
  );
}

function buildStyles(p: FitnessPalette) {
  return {
    root: {
      backgroundColor: p.bg,
      flex: 1,
    },
    scroll: {
      gap: layout.stackLoose,
      paddingHorizontal: layout.gutter,
      paddingTop: 8,
    },
    stack: {
      gap: layout.stack,
    },
    header: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
    },
    brand: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      gap: 8,
    },
    logo: {
      borderRadius: radius.sm,
      height: 32,
      width: 32,
    },
    brandName: {
      ...typeScale.subhead,
      color: p.text,
    },
    brandAdaptive: {
      ...typeScale.body,
      color: p.textMuted,
    },
    headerActions: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      gap: 8,
    },
    iconBtn: {
      alignItems: 'center' as const,
      backgroundColor: p.surface,
      borderColor: p.border,
      borderRadius: radius.full,
      borderWidth: 1,
      height: 36,
      justifyContent: 'center' as const,
      width: 36,
    },
    statusRow: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
    },
    statusLeft: {
      ...typeScale.body,
      color: p.textMuted,
      flex: 1,
      fontSize: 11,
    },
    statusRight: {
      ...typeScale.caption,
      color: p.lime,
      textTransform: 'none' as const,
    },
    greeting: {
      ...typeScale.hero,
      color: p.text,
      fontSize: 28,
      lineHeight: 32,
    },
    greetingSub: {
      ...typeScale.body,
      color: p.textSecondary,
      marginTop: -8,
    },
    sectionHead: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
    },
    kicker: {
      ...typeScale.caption,
      color: p.textMuted,
    },
    linkText: {
      ...typeScale.caption,
      color: p.lime,
      textTransform: 'none' as const,
    },
    quickRow: {
      gap: 14,
      paddingRight: 8,
    },
    quickItem: {
      alignItems: 'center' as const,
      width: 72,
    },
    quickIcon: {
      alignItems: 'center' as const,
      backgroundColor: p.limeDim,
      borderRadius: radius.full,
      height: 52,
      justifyContent: 'center' as const,
      width: 52,
    },
    quickIconOn: {
      backgroundColor: p.lime,
    },
    quickIconSoon: {
      backgroundColor: p.surfaceElevated,
    },
    quickLabel: {
      ...typeScale.body,
      color: p.text,
      fontSize: 11,
      marginTop: 6,
      textAlign: 'center' as const,
    },
    quickLabelSoon: {
      color: p.textSecondary,
    },
    quickSoon: {
      ...typeScale.body,
      color: p.textMuted,
      fontSize: 10,
      lineHeight: 12,
      textAlign: 'center' as const,
    },
    card: {
      ...elevation.card,
      backgroundColor: p.surface,
      borderColor: p.border,
      borderRadius: radius.xl,
      borderWidth: 1,
      gap: 10,
      padding: layout.cardPadding,
    },
    cardHead: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      gap: 8,
      justifyContent: 'space-between' as const,
    },
    cardTitle: {
      ...typeScale.subhead,
      color: p.text,
      flex: 1,
    },
    cardCopy: {
      flex: 1,
      gap: 4,
    },
    cardMeta: {
      ...typeScale.body,
      color: p.textSecondary,
    },
    moduleTitle: {
      ...typeScale.section,
      color: p.text,
      fontSize: 20,
      lineHeight: 24,
    },
    pill: {
      backgroundColor: p.surfaceElevated,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pillText: {
      ...typeScale.caption,
      color: p.textMuted,
      textTransform: 'none' as const,
    },
    pillBlue: {
      backgroundColor: p.limeDim,
    },
    pillTextBlue: {
      color: p.lime,
    },
    vitalHead: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      gap: 10,
    },
    vitalMark: {
      alignItems: 'center' as const,
      backgroundColor: p.limeDim,
      borderRadius: radius.md,
      height: 36,
      justifyContent: 'center' as const,
      width: 36,
    },
    trackPill: {
      alignItems: 'center' as const,
      borderRadius: radius.full,
      flexDirection: 'row' as const,
      flexShrink: 0,
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    trackDot: {
      borderRadius: radius.full,
      height: 6,
      width: 6,
    },
    vitalGrid: {
      gap: 10,
    },
    vitalRow: {
      flexDirection: 'row' as const,
      gap: 10,
    },
    vitalTile: {
      backgroundColor: p.bg,
      borderRadius: radius.lg,
      flex: 1,
      gap: 10,
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    vitalTop: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      gap: 6,
    },
    vitalLabel: {
      ...typeScale.body,
      color: p.textSecondary,
      flex: 1,
      fontSize: 12,
    },
    vitalMeta: {
      ...typeScale.body,
      fontSize: 12,
    },
    vitalFigure: {
      alignItems: 'baseline' as const,
      flexDirection: 'row' as const,
      gap: 4,
    },
    vitalValue: {
      ...typeScale.section,
      color: p.text,
      fontSize: 28,
      lineHeight: 32,
    },
    vitalUnit: {
      ...typeScale.body,
      color: p.textMuted,
      fontSize: 13,
    },
    vitalTrack: {
      backgroundColor: p.track,
      borderRadius: radius.full,
      height: 6,
      overflow: 'hidden' as const,
    },
    vitalFill: {
      borderRadius: radius.full,
      height: 6,
    },
    upcomingValue: {
      color: p.textMuted,
      fontSize: 16,
      lineHeight: 20,
    },
    feedHead: {
      flexDirection: 'row' as const,
      gap: 16,
    },
    feedTab: {
      gap: 6,
    },
    feedLabel: {
      ...typeScale.body,
      color: p.textMuted,
    },
    feedLabelOn: {
      color: p.text,
      fontFamily: typeScale.subhead.fontFamily,
    },
    feedBar: {
      backgroundColor: p.lime,
      borderRadius: radius.full,
      height: 2,
    },
    metricRow: {
      flexDirection: 'row' as const,
      gap: 8,
    },
    metric: {
      backgroundColor: p.bg,
      borderRadius: radius.md,
      flex: 1,
      gap: 2,
      padding: 10,
    },
    metricValue: {
      ...typeScale.subhead,
      color: p.text,
      fontSize: 13,
    },
    actionRow: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      gap: 8,
    },
    primaryBtn: {
      alignItems: 'center' as const,
      backgroundColor: p.lime,
      borderRadius: radius.full,
      flex: 1,
      flexDirection: 'row' as const,
      gap: 8,
      height: 44,
      justifyContent: 'center' as const,
    },
    primaryText: {
      ...typeScale.subhead,
      color: p.onLime,
    },
    moreBtn: {
      alignItems: 'center' as const,
      backgroundColor: p.bg,
      borderRadius: radius.full,
      height: 44,
      justifyContent: 'center' as const,
      width: 44,
    },
    split: {
      alignItems: 'flex-start' as const,
      flexDirection: 'row' as const,
      gap: 12,
    },
    budget: {
      alignItems: 'flex-end' as const,
    },
    budgetNow: {
      ...typeScale.section,
      color: p.text,
    },
    budgetGoal: {
      ...typeScale.body,
      color: p.textMuted,
    },
    macroRow: {
      flexDirection: 'row' as const,
      gap: 12,
    },
    macro: {
      flex: 1,
      gap: 2,
    },
    track: {
      backgroundColor: p.track,
      borderRadius: radius.full,
      height: 6,
      marginTop: 6,
      overflow: 'hidden' as const,
    },
    trackFill: {
      backgroundColor: p.lime,
      height: 6,
    },
    extensionGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    extension: {
      backgroundColor: p.bg,
      borderRadius: radius.md,
      flexBasis: '48%' as const,
      flexGrow: 1,
      gap: 2,
      padding: 10,
    },
    extensionLabel: {
      ...typeScale.body,
      color: p.text,
    },
    upcomingBtn: {
      alignItems: 'center' as const,
      backgroundColor: p.limeDim,
      borderRadius: radius.full,
      paddingVertical: 12,
    },
    upcomingBtnText: {
      ...typeScale.body,
      color: p.lime,
    },
    dockWrap: {
      left: layout.gutter,
      position: 'absolute' as const,
      right: layout.gutter,
    },
  };
}
