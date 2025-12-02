import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Dumbbell, User, Clock, BarChart2, Loader, LogIn, LogOut, UserPlus, Save, Calendar, X, Eye } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, collection, query } from 'firebase/firestore';

// --- CONFIGURAZIONE FIREBASE & UTILS ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Configurazione Firebase fornita da te per la pubblicazione su Vercel/esterna
// Usata come fallback se le variabili d'ambiente non sono presenti.
const FALLBACK_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBIEStcYXD7cw3VGVjgXiWijRY5Ym-pvyk",
    authDomain: "powerload-fae80.firebaseapp.com",
    projectId: "powerload-fae80",
    storageBucket: "powerload-fae80.firebasestorage.app",
    messagingSenderId: "770112940062",
    appId: "1:770112940062:web:c645670b1e96109429660f",
    measurementId: "G-969FES0RZS" 
};

// 1. Definisci la configurazione esterna leggendo le variabili d'ambiente (per Vercel)
const VERCEL_FIREBASE_CONFIG = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    // measurementId non è fondamentale per l'SDK web
};

// 2. Determina la configurazione da usare:
// a) Ambiente Canvas (__firebase_config)
// b) Variabili d'ambiente Vercel (VERCEL_FIREBASE_CONFIG)
// c) Fallback hardcoded (FALLBACK_FIREBASE_CONFIG)
const firebaseConfig = 
    typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : 
    VERCEL_FIREBASE_CONFIG.apiKey ? VERCEL_FIREBASE_CONFIG : 
    FALLBACK_FIREBASE_CONFIG;
    
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Funzione per inizializzare Firebase una sola volta
const initializeFirebase = (config) => {
    if (!config.apiKey) return [null, null, null];
    
    // Per evitare il doppio rendering o la doppia inizializzazione, 
    // l'istanza dell'app viene creata solo se non esiste già.
    const app = window._firebaseApp || initializeApp(config);
    window._firebaseApp = app; 
    
    const auth = getAuth(app);
    const db = getFirestore(app);
    return [app, auth, db];
};

const [appInstance, authInstance, dbInstance] = initializeFirebase(firebaseConfig);

const EXERCISE_LIST = [
  "Back Squat",
  "Front Squat",
  "Deadlift (Stacco)",
  "Bench Press (Panca Piana)",
  "Overhead Press (Military)",
  "Push Press",
  "Push Jerk",
  "Snatch (Strappo)",
  "Clean & Jerk (Slancio)",
  "Power Clean",
  "Power Snatch",
  "Pendlay Row",
  "Hip Thrust"
];

const DEFAULT_SET = {
  id: 0,
  reps: 5,
  percentage: 70,
  weight: 0,
  rest: 90 // secondi
};

const generateId = () => Date.now() + Math.random();

// Funzione helper per calcolare il peso
const calculateWeight = (pr, percentage) => Math.round((pr * percentage) / 100);

// --- COMPONENTE STORICO ALLENAMENTI ---
function WorkoutHistory({ userId, dbInstance, appId, setShowHistory }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWorkout, setSelectedWorkout] = useState(null);

    useEffect(() => {
        if (!userId || !dbInstance) return;

        // Path: /artifacts/{appId}/users/{userId}/data/history
        const historyCollectionRef = collection(dbInstance, `artifacts/${appId}/users/${userId}/data/history`);
        const q = query(historyCollectionRef); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const historyList = [];
            snapshot.forEach(doc => {
                historyList.push({ id: doc.id, ...doc.data() });
            });
            
            // Ordina in memoria per timestamp decrescente
            historyList.sort((a, b) => b.timestamp - a.timestamp);
            
            setHistory(historyList);
            setLoading(false);
        }, (error) => {
            console.error("Errore di fetch della cronologia:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, dbInstance, appId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full text-slate-400">
                <Loader className="w-6 h-6 animate-spin mr-2" /> Caricamento storico...
            </div>
        );
    }
    
    if (selectedWorkout) {
        return (
            <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700 max-w-4xl mx-auto">
                <button 
                    onClick={() => setSelectedWorkout(null)}
                    className="text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-1"
                >
                    <X className="w-4 h-4"/> Torna alla Cronologia
                </button>
                <h3 className="text-2xl font-bold mb-4 text-emerald-400 flex items-center gap-2">
                    <Calendar className="w-5 h-5"/> {selectedWorkout.date}
                </h3>
                <p className="text-slate-400 mb-6">Atleta: {selectedWorkout.athleteName || 'N/A'}</p>

                <div className="space-y-6">
                    {selectedWorkout.exercises.map((exercise, exIndex) => (
                        <div key={exIndex} className="bg-slate-700/50 p-4 rounded-lg">
                            <h4 className="text-xl font-semibold mb-2 text-white flex items-center gap-2">
                                <Dumbbell className="w-5 h-5 text-blue-400"/> {exercise.name} (1RM: {exercise.pr} kg)
                            </h4>
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-xs text-slate-400 uppercase border-b border-slate-600">
                                        <th className="p-1 w-12">Set</th>
                                        <th className="p-1">Reps</th>
                                        <th className="p-1">% Carico</th>
                                        <th className="p-1">Kg Totali</th>
                                        <th className="p-1">Recupero (s)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {exercise.sets.map((set, setIndex) => (
                                        <tr key={setIndex} className="border-b border-slate-700/50">
                                            <td className="p-1 font-mono text-slate-300">{setIndex + 1}</td>
                                            <td className="p-1">{set.reps}</td>
                                            <td className="p-1">{set.percentage}%</td>
                                            <td className="p-1 text-emerald-300 font-bold">{calculateWeight(exercise.pr, set.percentage)} kg</td>
                                            <td className="p-1">{set.rest} s</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-blue-400 flex items-center gap-2">
                <Calendar className="w-6 h-6"/> Diario di Allenamento
            </h2>
            <button 
                onClick={() => setShowHistory(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
                title="Chiudi"
            >
                <X className="w-6 h-6"/>
            </button>
            
            {history.length === 0 ? (
                <p className="text-slate-400 mt-4">Nessun allenamento salvato finora. Salva un allenamento dalla schermata principale per iniziare!</p>
            ) : (
                <ul className="space-y-3 mt-4">
                    {history.map((workout) => (
                        <li key={workout.id} className="flex items-center justify-between bg-slate-700/50 p-3 rounded-lg hover:bg-slate-700 transition-colors">
                            <div className="flex flex-col">
                                <span className="text-lg font-semibold text-white">{workout.date}</span>
                                <span className="text-sm text-slate-400">{workout.exercises.length} esercizi tracciati</span>
                            </div>
                            <button 
                                onClick={() => setSelectedWorkout(workout)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
                            >
                                <Eye className="w-4 h-4"/> Dettagli
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}


// --- AUTHENTICATION COMPONENT ---
function AuthForm({ setUserId }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(authInstance, email, password);
                setSuccess("Registrazione completata! Accesso in corso...");
            } else {
                await signInWithEmailAndPassword(authInstance, email, password);
            }
        } catch (err) {
            console.error(err);
            setError("Errore: Verifica email e password o riprova a registrarti.");
        }
    };

    return (
        <div className="max-w-md mx-auto bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700 mt-10">
            <h2 className="text-xl font-bold mb-4 text-blue-400 flex items-center gap-2">
                {isRegistering ? <UserPlus className="w-5 h-5"/> : <LogIn className="w-5 h-5"/>} 
                {isRegistering ? 'Crea un Account' : 'Accedi'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                {success && <p className="text-emerald-400 text-sm mt-2">{success}</p>}
                
                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors shadow-md"
                >
                    {isRegistering ? 'Registrati' : 'Accedi'}
                </button>
            </form>
            <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="mt-4 w-full text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
                {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati ora'}
            </button>
        </div>
    );
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [athleteName, setAthleteName] = useState('');
  const [exercises, setExercises] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null); // Nuovo stato per il feedback
  const [userId, setUserId] = useState(null);
  const [authReady, setAuthReady] = useState(false); 
  const [showHistory, setShowHistory] = useState(false); // Nuovo stato per la cronologia

  // Funzione useCallback per la comparazione profonda (Deep Check)
  const isDeepEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);


  // 1. Inizializzazione Auth e Listener
  useEffect(() => {
    if (!authInstance) {
        setAuthReady(true);
        // Se non c'è Firebase (e non si è loggati), carichiamo solo un esercizio di default.
        if (exercises.length === 0) {
             addExercise();
        }
        return;
    }

    const authenticate = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(authInstance, initialAuthToken);
        } else {
          await signInAnonymously(authInstance);
        }
      } catch (error) {
        console.error("Authentication failed:", error);
      }
    };

    authenticate();

    const unsubscribeAuth = onAuthStateChanged(authInstance, (user) => {
      setUserId(user ? user.uid : null);
      setAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, [authInstance]);

  // 2. Listener Firestore per i Dati Persistenti (Allenamento Corrente)
  useEffect(() => {
    if (!dbInstance || !userId || !authReady) {
        if (authReady && !userId) {
            setIsDataLoaded(true); 
        }
        return;
    }
    
    // Path per i dati privati: /artifacts/{appId}/users/{userId}/data/{docId}
    const dataDocRef = doc(dbInstance, `artifacts/${appId}/users/${userId}/data/latestWorkout`);

    const unsubscribeSnapshot = onSnapshot(dataDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // --- FIX: CONTROLLO DI UGUAGLIANZA PROFONDA ---
        const newExercises = data.exercises || [];
        const newAthleteName = data.athleteName || '';

        // Aggiorniamo lo stato SOLO se i dati sono cambiati per evitare il loop
        if (!isDeepEqual(newExercises, exercises) || newAthleteName !== athleteName) {
            setAthleteName(newAthleteName);
            setExercises(newExercises);
        }
        // --- FINE FIX ---
      } else {
        if (exercises.length === 0) {
            addExercise();
        }
      }
      setIsDataLoaded(true);
    }, (error) => {
      console.error("Errore di ascolto Firestore:", error);
      setIsDataLoaded(true);
    });

    return () => unsubscribeSnapshot();
  }, [userId, authReady, dbInstance]); 

  // 3. Funzione di Salvataggio (Allenamento Corrente - Salvataggio Automatico)
  const saveCurrentWorkout = useCallback(async (name, currentExercises) => {
    if (!userId || !dbInstance || !authReady) return;
    
    setIsSaving(true);
    try {
        const dataDocRef = doc(dbInstance, `artifacts/${appId}/users/${userId}/data/latestWorkout`);
        
        // Creiamo una copia serializzabile per il salvataggio
        const serializableExercises = currentExercises.map(ex => ({
            ...ex,
            // Conserviamo solo le proprietà necessarie per i set
            sets: ex.sets.map(s => ({ reps: s.reps, percentage: s.percentage, rest: s.rest, id: s.id }))
        }));

        await setDoc(dataDocRef, {
            athleteName: name,
            exercises: serializableExercises,
            timestamp: Date.now(),
            userId: userId
        });
        
    } catch (error) {
        console.error("Salvataggio corrente fallito:", error);
    } finally {
        setIsSaving(false); 
    }
  }, [userId, dbInstance, authReady, appId]);
  
  // 4. Funzione per salvare l'allenamento completato nella cronologia
  const saveCompletedWorkout = async () => {
    if (!userId || !dbInstance || !authReady) {
        setSaveSuccess({ status: 'error', message: "Devi essere loggato per salvare l'allenamento!" });
        return;
    }
    if (exercises.length === 0) {
        setSaveSuccess({ status: 'error', message: "Aggiungi almeno un esercizio prima di salvare." });
        return;
    }

    setIsSaving(true);
    setSaveSuccess(null);
    try {
        const today = new Date();
        // ID univoco basato su data e timestamp
        const workoutId = today.toISOString().split('T')[0] + '-' + Date.now(); 

        // Path: /artifacts/{appId}/users/{userId}/data/history/{workoutId}
        const historyDocRef = doc(dbInstance, `artifacts/${appId}/users/${userId}/data/history/${workoutId}`);
        
        const serializableExercises = exercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => ({ reps: s.reps, percentage: s.percentage, rest: s.rest, id: s.id }))
        }));

        await setDoc(historyDocRef, {
            date: today.toISOString().split('T')[0], // Data pulita
            timestamp: Date.now(),
            athleteName: athleteName,
            exercises: serializableExercises,
            userId: userId
        });

        setSaveSuccess({ status: 'success', message: `Allenamento del ${today.toLocaleDateString()} salvato con successo!` });
        
        // Rimuoviamo i dati dell'allenamento corrente dopo averlo salvato in cronologia
        await setDoc(doc(dbInstance, `artifacts/${appId}/users/${userId}/data/latestWorkout`), {
            athleteName: athleteName,
            exercises: [],
            timestamp: Date.now(),
            userId: userId
        });

        setExercises([]); // Pulizia immediata del form
        // Non puliamo athleteName per comodità

    } catch (error) {
        console.error("Salvataggio cronologia fallito:", error);
        setSaveSuccess({ status: 'error', message: "Errore durante il salvataggio della cronologia." });
    } finally {
        setTimeout(() => {
            setIsSaving(false);
             // Nasconde il messaggio di successo dopo un po'
             setSaveSuccess(null);
        }, 3000); 
    }
  };


  // 5. Salvataggio Automatico (Debounced)
  useEffect(() => {
    if (!isDataLoaded || !userId) return;

    const handler = setTimeout(() => {
        saveCurrentWorkout(athleteName, exercises);
    }, 500); 

    return () => {
        clearTimeout(handler);
    };
  }, [athleteName, exercises, userId, isDataLoaded, saveCurrentWorkout]); // Aggiunto saveCurrentWorkout come dipendenza
  
  // Funzioni di manipolazione dello stato
  const addExercise = () => {
    const newExercise = {
      id: generateId(),
      name: EXERCISE_LIST[0],
      pr: 100, // Default PR
      sets: [
        { ...DEFAULT_SET, id: generateId() + 1 },
        { ...DEFAULT_SET, id: generateId() + 2 },
        { ...DEFAULT_SET, id: generateId() + 3 }
      ]
    };
    setExercises([...exercises, newExercise]);
  };

  const removeExercise = (exerciseId) => setExercises(exercises.filter(ex => ex.id !== exerciseId));

  const updateExercise = (id, field, value) => {
    setExercises(exercises.map(ex => (ex.id === id ? { ...ex, [field]: value } : ex)));
  };

  const addSet = (exerciseId) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const lastSet = ex.sets[ex.sets.length - 1] || DEFAULT_SET;
        // Assegna un nuovo ID al nuovo set per garantire l'unicità
        return { ...ex, sets: [...ex.sets, { ...lastSet, id: generateId() }] }; 
      }
      return ex;
    }));
  };

  const removeSet = (exerciseId, setId) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId && ex.sets.length > 1) {
        return { ...ex, sets: ex.sets.filter(s => s.id !== setId) };
      }
      return ex;
    }));
  };

  const updateSet = (exerciseId, setId, field, value) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        // Assicurati che 'value' sia numerico per i campi numerici
        const parsedValue = (field === 'reps' || field === 'percentage' || field === 'rest') ? parseFloat(value) : value;

        const updatedSets = ex.sets.map(s => (s.id === setId ? { ...s, [field]: parsedValue } : s));
        return { ...ex, sets: updatedSets };
      }
      return ex;
    }));
  };
  
  const handleLogout = () => {
      if (authInstance) signOut(authInstance);
      setExercises([]); 
      setAthleteName('');
      setIsDataLoaded(false); 
      setUserId(null); // Resetta l'ID utente al logout
  };

  // --- RENDERING CON STATO DI AUTENTICAZIONE ---

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-lg">Inizializzazione servizi...</span>
      </div>
    );
  }

  if (!userId) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 pb-20">
            <header className="mb-8 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                    <BarChart2 className="w-8 h-8 text-blue-500" />
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">PowerLoad Pro</h1>
                </div>
                <p className="text-slate-400 text-sm">Accedi per salvare i tuoi allenamenti.</p>
            </header>
            <AuthForm setUserId={setUserId} />
        </div>
      );
  }
  
  // Se l'utente è loggato ma ha selezionato la cronologia, mostriamo quella
  if (showHistory) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 pb-20 relative">
            <WorkoutHistory 
                userId={userId} 
                dbInstance={dbInstance} 
                appId={appId} 
                setShowHistory={setShowHistory} 
            />
        </div>
      );
  }

  // UI principale (quando loggato)
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 pb-20">
      
      {/* Header */}
      <header className="mb-8 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            PowerLoad Pro
          </h1>
        </div>
        <div className="flex items-center text-slate-400 text-sm gap-2">
            <User className="w-3 h-3"/>
            Account attivo | 
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                <LogOut className="w-3 h-3"/> Esci
            </button>
        </div>
      </header>
      
      {/* Messaggi di stato/salvataggio */}
      <div className="max-w-3xl mx-auto mb-4 min-h-6">
        {isSaving && (
            <div className="flex items-center text-xs text-slate-400">
              <Loader className="w-3 h-3 animate-spin text-blue-400 mr-1" />
              Salvataggio automatico (Allenamento Corrente)...
            </div>
          )}
          {saveSuccess && (
              <div className={`flex items-center text-sm p-2 rounded ${saveSuccess.status === 'success' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}`}>
                  {saveSuccess.status === 'success' ? <Calendar className="w-4 h-4 mr-2" /> : <X className="w-4 h-4 mr-2" />}
                  {saveSuccess.message}
              </div>
          )}
      </div>

      {/* Athlete Input */}
      <div className="max-w-md mx-auto bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 mb-6">
        <div className="flex items-center gap-3">
          <User className="text-blue-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Nome Atleta"
            className="bg-transparent border-b border-slate-600 focus:border-blue-500 outline-none w-full text-lg py-1 transition-colors"
            value={athleteName}
            onChange={(e) => setAthleteName(e.target.value)}
          />
        </div>
      </div>

      {/* Exercises List */}
      <div className="max-w-3xl mx-auto space-y-6">
        {exercises.map((exercise, index) => (
          <div key={exercise.id} className="bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-700">
            
            {/* Exercise Header */}
            <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <Dumbbell className="text-blue-400 w-6 h-6" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Esercizio</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={exercise.name}
                    onChange={(e) => updateExercise(exercise.id, 'name', e.target.value)}
                  >
                    {EXERCISE_LIST.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                 <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">1RM (kg)</label>
                    <input
                      type="number"
                      className="w-24 bg-slate-900 border border-slate-600 rounded p-2 mt-1 text-center font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={exercise.pr}
                      onChange={(e) => updateExercise(exercise.id, 'pr', parseFloat(e.target.value) || 0)}
                    />
                 </div>
                 <button 
                    onClick={() => removeExercise(exercise.id)}
                    className="text-slate-500 hover:text-red-400 p-2 transition-colors mt-5"
                    title="Rimuovi Esercizio"
                 >
                    <Trash2 className="w-5 h-5" />
                 </button>
              </div>
            </div>

            {/* Sets Table */}
            <div className="p-2 sm:p-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                    <th className="p-2 w-12 text-center">Set</th>
                    <th className="p-2">Reps</th>
                    <th className="p-2">% Carico</th>
                    <th className="p-2">Kg Totali</th>
                    <th className="p-2 hidden sm:table-cell">Recupero</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {exercise.sets.map((set, idx) => {
                    const weight = calculateWeight(exercise.pr, set.percentage);
                    return (
                      <tr key={set.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                        <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            className="w-16 bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-center focus:border-blue-400 outline-none"
                            value={set.reps}
                            onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className="w-16 bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-center focus:border-blue-400 outline-none"
                              value={set.percentage}
                              onChange={(e) => updateSet(exercise.id, set.id, 'percentage', e.target.value)}
                              step="2.5"
                            />
                            <span className="text-slate-500">%</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded font-bold text-center w-20 border border-emerald-500/20">
                            {weight} <span className="text-xs font-normal">kg</span>
                          </div>
                        </td>
                        <td className="p-2 hidden sm:table-cell">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="w-3 h-3" />
                            <input
                                type="number"
                                className="w-16 bg-transparent border-b border-slate-600 text-center focus:border-blue-400 outline-none"
                                value={set.rest}
                                onChange={(e) => updateSet(exercise.id, set.id, 'rest', e.target.value)}
                            />
                            <span className="text-xs">s</span>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <button 
                            onClick={() => removeSet(exercise.id, set.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Add Set Button */}
              <button
                onClick={() => addSet(exercise.id)}
                className="mt-4 w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-400 border border-dashed border-slate-600 rounded hover:bg-slate-700/30 hover:text-slate-200 transition-all"
              >
                <Plus className="w-4 h-4" /> Aggiungi Serie
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-4">
        
        {/* Nuovo: Visualizza Storico */}
        <button
          onClick={() => setShowHistory(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-full shadow-lg shadow-purple-900/50 transition-transform hover:scale-105 flex items-center justify-center"
          title="Visualizza Cronologia"
        >
          <Calendar className="w-8 h-8" />
        </button>

        {/* Nuovo: Salva Allenamento Completato */}
        <button
          onClick={saveCompletedWorkout}
          className="bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-lg shadow-emerald-900/50 transition-transform hover:scale-105 flex items-center justify-center"
          title="Salva Allenamento Completato"
        >
          <Save className="w-8 h-8" />
        </button>

        {/* Aggiungi Esercizio */}
        <button
          onClick={addExercise}
          className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-lg shadow-blue-900/50 transition-transform hover:scale-105 flex items-center justify-center"
          title="Nuovo Esercizio"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>

      {/* Empty State Helper */}
      {exercises.length === 0 && (
        <div className="text-center mt-20 text-slate-500">
          <p>Nessun esercizio aggiunto.</p>
          <button onClick={addExercise} className="text-blue-400 underline mt-2">Inizia aggiungendone uno</button>
        </div>
      )}

    </div>
  );
}
