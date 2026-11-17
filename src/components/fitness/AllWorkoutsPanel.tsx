import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { uploadImage } from '../../api/imagesApi';
import {
  getActiveWorkoutPlan,
  listExerciseCatalog,
  updateExerciseImage,
  updateWorkoutPlanExercise,
} from '../../api/workoutApi';
import type { FitnessPalette } from '../../constants/fitnessPalette';
import { useFitnessPalette, useFitnessStyles } from '../../hooks/useFitnessPalette';
import { useIsWorkoutAdmin } from '../../hooks/useIsWorkoutAdmin';
import { confirmFitnessAction } from '../../lib/fitness/confirmAction';
import { pickDemoMedia } from '../../services/pickAndPrepareImage';
import { resolveFitnessMediaUrl } from '../../lib/fitness/mediaUrl';
import { applyCatalogMedia } from '../../lib/fitness/workoutResponse';
import type { WorkoutDay, WorkoutExercise, WorkoutPlan } from '../../types/fitness';
import { getApiErrorMessage } from '../../utils/api';

type Draft = {
  sets: string;
  reps: string;
  rest: string;
};

type AllWorkoutsPanelProps = {
  todayDayId?: string | null;
};

export function AllWorkoutsPanel({ todayDayId }: AllWorkoutsPanelProps) {
  const palette = useFitnessPalette();
  const styles = useFitnessStyles(buildStyles);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ sets: '', reps: '', rest: '' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const canReplaceDemo = useIsWorkoutAdmin();
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (mode: 'full' | 'soft' = 'full') => {
    if (mode === 'full') {
      setStatus('loading');
      setError(null);
    } else {
      setRefreshing(true);
    }
    try {
      const [nextPlan, catalog] = await Promise.all([
        getActiveWorkoutPlan(),
        listExerciseCatalog(),
      ]);
      if (!nextPlan) {
        setPlan(null);
      } else {
        setPlan({
          ...nextPlan,
          days: nextPlan.days.map((day) => ({
            ...day,
            exercises: applyCatalogMedia(day.exercises, catalog),
          })),
        });
      }
      setStatus('ready');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load workouts.'));
      if (mode === 'full') setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(hasLoadedRef.current ? 'soft' : 'full').then(() => {
        hasLoadedRef.current = true;
      });
    }, [load]),
  );

  const onReplaceDemo = async (exercise: WorkoutExercise) => {
    const catalogId = exercise.exerciseId || exercise.id;
    if (!catalogId) return;
    const prepared = await pickDemoMedia();
    if (!prepared) return;
    const ok = await confirmFitnessAction(
      'Replace this demo?',
      `Use your file for ${exercise.name}? This updates the shared movement, and only an admin can do it.`,
    );
    if (!ok) return;
    setReplacingId(exercise.id);
    try {
      const { url } = await uploadImage({
        uri: prepared.uri,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        type: 'workout',
      });
      await updateExerciseImage(catalogId, url);
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((day) => ({
            ...day,
            exercises: day.exercises.map((item) =>
              item.exerciseId === catalogId || item.name === exercise.name
                ? { ...item, imageUrl: url }
                : item,
            ),
          })),
        };
      });
      Toast.show({
        type: 'success',
        text1: 'Demo replaced',
        position: 'bottom',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Replace failed',
        text2: getApiErrorMessage(err, 'Unable to replace this demo.'),
        position: 'bottom',
      });
    } finally {
      setReplacingId(null);
    }
  };

  const startEdit = (exercise: WorkoutExercise) => {
    setEditingId(exercise.id);
    setDraft({
      sets: String(exercise.targetSets || 1),
      reps: String(exercise.targetReps ?? ''),
      rest: String(exercise.restSeconds || 0),
    });
  };

  const onSave = async (exercise: WorkoutExercise) => {
    const sets = Number(draft.sets);
    const restSeconds = Number(draft.rest);
    const reps = draft.reps.trim();
    if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
      Toast.show({
        type: 'error',
        text1: 'Sets must be between 1 and 20',
        position: 'bottom',
      });
      return;
    }
    if (!reps) {
      Toast.show({
        type: 'error',
        text1: 'Enter the reps',
        position: 'bottom',
      });
      return;
    }
    if (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > 600) {
      Toast.show({
        type: 'error',
        text1: 'Rest must be between 0 and 600 seconds',
        position: 'bottom',
      });
      return;
    }

    const ok = await confirmFitnessAction(
      'Update this exercise?',
      `Save ${sets} sets, ${reps} reps, and ${restSeconds}s rest for ${exercise.name}?`,
    );
    if (!ok) return;

    setSavingId(exercise.id);
    try {
      await updateWorkoutPlanExercise(exercise.id, { sets, reps, restSeconds });
      setPlan((current) => {
        if (!current) return current;
        return {
          ...current,
          days: current.days.map((day) => ({
            ...day,
            exercises: day.exercises.map((item) =>
              item.id === exercise.id
                ? { ...item, targetSets: sets, targetReps: reps, restSeconds }
                : item,
            ),
          })),
        };
      });
      setEditingId(null);
      Toast.show({
        type: 'success',
        text1: 'Workout updated',
        position: 'bottom',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: getApiErrorMessage(err, 'Unable to update workout.'),
        position: 'bottom',
      });
    } finally {
      setSavingId(null);
    }
  };

  const days = plan?.days ?? [];

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={palette.lime}
          onRefresh={() => void load('soft')}
        />
      }
    >
      <Text style={styles.eyebrow}>Workout · Full plan</Text>
      <Text style={styles.title}>All workouts</Text>
      <Text style={styles.muted}>
        Every day in your plan. Update sets, reps, or rest before you train.
      </Text>

      {status === 'loading' && days.length === 0 ? (
        <View style={styles.card}>
          <ActivityIndicator color={palette.lime} />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Couldn’t load workouts</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'ready' && days.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No workout plan yet</Text>
          <Text style={styles.muted}>
            Generate a plan from Today, then every day shows up here.
          </Text>
        </View>
      ) : null}

      {days.map((day) => (
        <DaySection
          key={day.id}
          day={day}
          draft={draft}
          canReplaceDemo={canReplaceDemo}
          editingId={editingId}
          isToday={Boolean(todayDayId && day.id === todayDayId)}
          replacingId={replacingId}
          savingId={savingId}
          onCancel={() => setEditingId(null)}
          onReplaceDemo={(exercise) => void onReplaceDemo(exercise)}
          onChange={setDraft}
          onEdit={startEdit}
          onSave={(exercise) => void onSave(exercise)}
        />
      ))}
    </ScrollView>
  );
}

function Demo({
  uri,
  canReplace,
  replacing,
  onReplace,
}: {
  uri?: string | null;
  canReplace: boolean;
  replacing: boolean;
  onReplace: () => void;
}) {
  const palette = useFitnessPalette();
  const styles = useFitnessStyles(buildStyles);
  const resolved = resolveFitnessMediaUrl(uri);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setOpen(false);
  }, [resolved]);

  if (!resolved || failed) {
    if (!canReplace) return null;
    return (
      <Pressable
        accessibilityRole="button"
        disabled={replacing}
        onPress={onReplace}
        style={styles.ghostBtn}
      >
        {replacing ? (
          <ActivityIndicator color={palette.lime} />
        ) : (
          <>
            <Ionicons color={palette.lime} name="cloud-upload-outline" size={16} />
            <Text style={styles.demoToggleText}>Replace demo</Text>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.demoBlock}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={styles.demoToggle}
      >
        <Ionicons
          color={palette.lime}
          name={open ? 'chevron-up' : 'play-circle-outline'}
          size={16}
        />
        <Text style={styles.demoToggleText}>{open ? 'Hide demo' : 'How to do it'}</Text>
      </Pressable>
      {open ? (
        <Image
          accessibilityIgnoresInvertColors
          key={resolved}
          onError={() => setFailed(true)}
          resizeMode="contain"
          source={{ uri: resolved }}
          style={styles.demoImage}
        />
      ) : null}
      {canReplace ? (
        <Pressable
          accessibilityRole="button"
          disabled={replacing}
          onPress={onReplace}
          style={styles.ghostBtn}
        >
          {replacing ? (
            <ActivityIndicator color={palette.lime} />
          ) : (
            <>
              <Ionicons color={palette.lime} name="cloud-upload-outline" size={16} />
              <Text style={styles.demoToggleText}>Replace demo</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function DaySection({
  day,
  isToday,
  canReplaceDemo,
  editingId,
  draft,
  replacingId,
  savingId,
  onEdit,
  onCancel,
  onChange,
  onReplaceDemo,
  onSave,
}: {
  day: WorkoutDay;
  isToday: boolean;
  canReplaceDemo: boolean;
  editingId: string | null;
  draft: Draft;
  replacingId: string | null;
  savingId: string | null;
  onEdit: (exercise: WorkoutExercise) => void;
  onCancel: () => void;
  onChange: (next: Draft) => void;
  onReplaceDemo: (exercise: WorkoutExercise) => void;
  onSave: (exercise: WorkoutExercise) => void;
}) {
  const palette = useFitnessPalette();
  const styles = useFitnessStyles(buildStyles);
  const title = day.label || day.focus || `Day ${day.dayNumber ?? ''}`.trim();

  return (
    <View style={styles.dayBlock}>
      <View style={styles.dayHead}>
        <Text style={styles.dayTitle}>
          {day.dayNumber ? `Day ${day.dayNumber}` : 'Day'}
          {title ? ` · ${title}` : ''}
        </Text>
        {isToday ? (
          <View style={styles.todayPill}>
            <Text style={styles.todayPillText}>Today</Text>
          </View>
        ) : null}
      </View>
      {day.exercises.map((exercise, index) => {
        const editing = editingId === exercise.id;
        const saving = savingId === exercise.id;
        return (
          <View key={exercise.id} style={styles.card}>
            <Demo
              canReplace={canReplaceDemo}
              replacing={replacingId === exercise.id}
              uri={exercise.imageUrl}
              onReplace={() => onReplaceDemo(exercise)}
            />
            <Text style={styles.exerciseIndex}>Exercise {index + 1}</Text>
            <Text style={styles.cardTitle}>{exercise.name}</Text>
            <Text style={styles.muted}>
              {exercise.targetSets} sets · {exercise.targetReps ?? '—'} reps ·{' '}
              {exercise.restSeconds}s rest
            </Text>
            {editing ? (
              <View style={styles.editBlock}>
                <Field
                  keyboardType="number-pad"
                  label="Sets"
                  value={draft.sets}
                  onChangeText={(sets) => onChange({ ...draft, sets })}
                />
                <Field
                  label="Reps"
                  value={draft.reps}
                  onChangeText={(reps) => onChange({ ...draft, reps })}
                />
                <Field
                  keyboardType="number-pad"
                  label="Rest (sec)"
                  value={draft.rest}
                  onChangeText={(rest) => onChange({ ...draft, rest })}
                />
                <View style={styles.editActions}>
                  <Pressable onPress={onCancel} style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={saving}
                    onPress={() => onSave(exercise)}
                    style={styles.primaryBtn}
                  >
                    {saving ? (
                      <ActivityIndicator color={palette.onLime} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Save</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => onEdit(exercise)} style={styles.ghostBtn}>
                <Ionicons color={styles.ghostBtnText.color} name="create-outline" size={16} />
                <Text style={styles.ghostBtnText}>Update</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'number-pad' | 'default';
}) {
  const styles = useFitnessStyles(buildStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function buildStyles(p: FitnessPalette) {
  return {
    fill: { flex: 1 },
    content: { gap: 14, padding: 18, paddingBottom: 110 },
    eyebrow: {
      color: p.textSecondary,
      fontSize: 12,
      fontWeight: '700' as const,
      letterSpacing: 0.4,
      textTransform: 'uppercase' as const,
    },
    title: { color: p.text, fontSize: 28, fontWeight: '800' as const },
    muted: { color: p.textMuted, fontSize: 14, lineHeight: 20 },
    dayBlock: { gap: 10 },
    dayHead: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      gap: 8,
      justifyContent: 'space-between' as const,
    },
    dayTitle: { color: p.text, flex: 1, fontSize: 16, fontWeight: '800' as const },
    todayPill: {
      backgroundColor: p.lime,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    todayPillText: { color: p.onLime, fontSize: 12, fontWeight: '800' as const },
    card: {
      backgroundColor: p.surface,
      borderColor: p.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 8,
      padding: 14,
    },
    cardTitle: { color: p.text, fontSize: 18, fontWeight: '800' as const },
    exerciseIndex: {
      color: p.limeSoft,
      fontSize: 11,
      fontWeight: '800' as const,
      textTransform: 'uppercase' as const,
    },
    editBlock: { gap: 10, marginTop: 4 },
    field: { gap: 4 },
    fieldLabel: { color: p.textSecondary, fontSize: 12, fontWeight: '700' as const },
    input: {
      backgroundColor: p.surfaceElevated,
      borderColor: p.border,
      borderRadius: 12,
      borderWidth: 1,
      color: p.text,
      fontSize: 16,
      fontWeight: '700' as const,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    editActions: { flexDirection: 'row' as const, gap: 8 },
    primaryBtn: {
      alignItems: 'center' as const,
      backgroundColor: p.lime,
      borderRadius: 12,
      flex: 1,
      justifyContent: 'center' as const,
      minHeight: 44,
      paddingHorizontal: 14,
    },
    primaryBtnText: { color: p.onLime, fontSize: 15, fontWeight: '800' as const },
    ghostBtn: {
      alignItems: 'center' as const,
      alignSelf: 'flex-start' as const,
      borderColor: p.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row' as const,
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 12,
      justifyContent: 'center' as const,
    },
    ghostBtnText: { color: p.text, fontSize: 14, fontWeight: '700' as const },
    demoBlock: { gap: 8 },
    demoToggle: { alignItems: 'center' as const, flexDirection: 'row' as const, gap: 6 },
    demoToggleText: { color: p.lime, fontSize: 14, fontWeight: '800' as const },
    demoImage: {
      aspectRatio: 1,
      backgroundColor: '#F4E7D4',
      borderRadius: 16,
      width: '100%' as const,
    },
  };
}
