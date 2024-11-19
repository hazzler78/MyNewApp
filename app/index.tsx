import { Text, View, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform, Image, TextInput } from "react-native";
import { useState, useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';

type Fly = {
  id: string;
  position: { top: number; left: number };
};

type Level = {
  name: string;
  timeLimit: number;
  numberOfFlies: number;
  pointsPerFly: number;
  colors: string[];
};

type HighScore = {
  score: number;
  date: string;
  playerName: string;
};

type HighScores = Record<number, HighScore[]>;

const LEVELS: Level[] = [
  {
    name: "Beginner",
    timeLimit: 30,
    numberOfFlies: 8,
    pointsPerFly: 1,
    colors: ['#a8e6cf', '#dcedc1'] as const
  },
  {
    name: "Advanced",
    timeLimit: 25,
    numberOfFlies: 5,
    pointsPerFly: 1,
    colors: ['#ffd3b6', '#ffaaa5'] as const
  },
  {
    name: "Expert",
    timeLimit: 20,
    numberOfFlies: 3,
    pointsPerFly: 1,
    colors: ['#ff8b94', '#ff6b6b'] as const
  }
];

const generateNewFlyPosition = () => {
  const FLY_SIZE = 50;
  const HEADER_HEIGHT = 100;
  const BOTTOM_PADDING = 150;
  const SIDE_PADDING = 20;
  
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  
  // Ensure flies stay fully within visible area
  const maxLeft = windowWidth - FLY_SIZE - SIDE_PADDING;
  const maxTop = windowHeight - FLY_SIZE - BOTTOM_PADDING;
  const minLeft = SIDE_PADDING;
  const minTop = HEADER_HEIGHT + SIDE_PADDING;
  
  // Round positions to prevent partial pixel placement
  return {
    left: Math.floor(Math.random() * (maxLeft - minLeft)) + minLeft,
    top: Math.floor(Math.random() * (maxTop - minTop)) + minTop
  };
};

// Add this component before the main Index component
const Fly = ({ id, position, onCatch }: { id: string; position: { top: number; left: number }; onCatch: (id: string, position: { top: number; left: number }) => void }) => {
  const windowHeight = Dimensions.get('window').height;
  const isNearBottom = position.top > (windowHeight - 200);

  return (
    <TouchableOpacity
      onPress={() => onCatch(id, position)}
      style={[
        styles.fly,
        {
          top: position.top,
          left: position.left,
          padding: isNearBottom ? 15 : 5,
        },
      ]}
    >
      {Platform.OS === 'web' ? (
        <Image 
          source={require('../assets/fly.png')} 
          style={styles.flyImage}
          resizeMode="contain"
        />
      ) : (
        <Text style={styles.flyEmoji}>🪰</Text>
      )}
    </TouchableOpacity>
  );
};

// Add this component next to the Fly component
const Splat = ({ position }: { position: { top: number; left: number } }) => {
  return (
    <View
      style={[
        styles.splat,
        {
          top: position.top,
          left: position.left,
        },
      ]}
    >
      {Platform.OS === 'web' ? (
        <Image 
          source={require('../assets/splat.png')} 
          style={styles.splatImage}
          resizeMode="contain"
        />
      ) : (
        <Text style={styles.splatEmoji}>💥</Text>
      )}
    </View>
  );
};

const HIGHSCORES_STORAGE_KEY = '@fly_swatter_highscores';

export default function Index() {
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highScores, setHighScores] = useState<HighScores>({
    0: [],
    1: [],
    2: []
  });
  const [splats, setSplats] = useState<Array<{top: number, left: number}>>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStatus, setGameStatus] = useState<'idle' | 'countdown' | 'playing' | 'ended'>('idle');
  const [flies, setFlies] = useState<Fly[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [playerName, setPlayerName] = useState<string>('');
  const [showNameInput, setShowNameInput] = useState(false);

  // Move debug function here, after all state declarations
  const debugHighScores = (message: string) => {
    console.log(`[DEBUG] ${message}`, {
      currentLevel,
      score,
      highScores,
    });
  };

  const selectLevel = (index: number) => {
    setCurrentLevel(index);
  };

  // Add some console logs to help us debug
  useEffect(() => {
    console.log('Game Status:', gameStatus);
    console.log('Time Left:', timeLeft);
    console.log('Is Playing:', isPlaying);
  }, [gameStatus, timeLeft, isPlaying]);

  // Load high scores when component mounts
  useEffect(() => {
    const loadHighScores = async () => {
      try {
        const savedScores = await AsyncStorage.getItem(HIGHSCORES_STORAGE_KEY);
        console.log('Loading saved scores:', savedScores);
        
        if (savedScores) {
          const parsedScores = JSON.parse(savedScores);
          console.log('Parsed saved scores:', parsedScores);
          setHighScores(parsedScores);
        } else {
          console.log('No saved scores found, initializing with defaults');
          const initialScores = {
            0: [],
            1: [],
            2: []
          };
          await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(initialScores));
          setHighScores(initialScores);
        }
      } catch (error) {
        console.error('Error loading high scores:', error);
      }
    };

    loadHighScores();
  }, []); // Only run once on mount

  // Save high scores whenever they change
  useEffect(() => {
    const saveHighScores = async () => {
      try {
        await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(highScores));
        console.log('Saved high scores:', highScores); // Debug log
      } catch (error) {
        console.error('Error saving high scores:', error);
      }
    };

    saveHighScores();
  }, [highScores]);

  const startGame = () => {
    // Reset everything
    setFlies([]);
    setSplats([]);
    setScore(0);
    setGameStatus('countdown');
    setCountdown(3);
    setIsPlaying(false);
    const timer = setInterval(() => {
      setCountdown((prev: number | null) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          
          // Start the game with correct number of flies
          setTimeout(() => {
            setGameStatus('playing');
            setTimeLeft(LEVELS[currentLevel].timeLimit);
            setIsPlaying(true);
            
            // Create initial flies
            const initialFlies = Array.from(
              { length: LEVELS[currentLevel].numberOfFlies },
              (_, index) => ({
                id: `fly-${Date.now()}-${index}`,
                position: generateNewFlyPosition()
              })
            );
            setFlies(initialFlies);
          }, 1000);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Game timer
  useEffect(() => {
    let timer: number | undefined;
    if (isPlaying && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((current: number) => {
          const newTime = current - 1;
          if (newTime <= 0) {
            window.clearInterval(timer);
            setIsPlaying(false);
            
            // Check if score qualifies for leaderboard
            const currentScores = highScores[currentLevel] || [];
            const lowestScore = currentScores.length > 0 
              ? Math.min(...currentScores.map(s => s.score))
              : 0;
            
            if (currentScores.length < 10 || score > lowestScore) {
              setShowNameInput(true);
            } else {
              setGameStatus('ended');
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, timeLeft, currentLevel, score, highScores]);

  const catchFly = (flyId: string, position: { top: number; left: number }) => {
    if (!isPlaying || timeLeft <= 0) return;
    
    setSplats(prev => [...prev, position]);
    setScore(prev => prev + 1);
    
    // Remove caught fly and add new one immediately
    setFlies(prev => {
      const remaining = prev.filter(f => f.id !== flyId);
      const newFly = {
        id: `fly-${Date.now()}-${Math.random()}`,
        position: generateNewFlyPosition()
      };
      return [...remaining, newFly];
    });

    // Clean up splat after 1 second
    setTimeout(() => {
      setSplats(prev => prev.filter(p => p.top !== position.top || p.left !== position.left));
    }, 1000);
  };

  // Add this useEffect to maintain correct number of flies
  useEffect(() => {
    if (isPlaying && gameStatus === 'playing') {
      const targetFlies = LEVELS[currentLevel].numberOfFlies;
      
      if (flies.length !== targetFlies) {
        console.log('Adjusting fly count:', {
          current: flies.length,
          target: targetFlies
        });
        
        if (flies.length < targetFlies) {
          // Add missing flies
          const newFlies = Array.from(
            { length: targetFlies - flies.length },
            () => ({
              id: `fly-${Date.now()}-${Math.random()}`,
              position: generateNewFlyPosition()
            })
          );
          setFlies((prev: Fly[]) => [...prev, ...newFlies]);
        } else {
          // Remove extra flies if somehow we have too many
          setFlies((prev: Fly[]) => prev.slice(0, targetFlies));
        }
      }
    }
  }, [flies.length, isPlaying, gameStatus, currentLevel]);

  // Add reset function near other game functions
  const handleResetPress = () => {

    try {
      const initialScores = {
        0: [],
        1: [],
        2: []
      };
      const saveScores = async () => {
        await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(initialScores));
      };
      saveScores();
      setHighScores(initialScores);
    } catch (error) {
      console.error('Error resetting high scores:', error);
    }
  };

  // Add this near the top of the Index component
  useEffect(() => {
    const checkHighScores = async () => {
      try {
        const savedScores = await AsyncStorage.getItem(HIGHSCORES_STORAGE_KEY);
        console.log('Current stored high scores:', savedScores);
      } catch (error) {
        console.error('Error checking high scores:', error);
      }
    };

    checkHighScores();
  }, [highScores]); // This will log whenever highScores changes

  // Add console log to debug high scores
  useEffect(() => {
    console.log('Current high scores:', highScores);
  }, [highScores]);

  // Add this effect to monitor high scores changes
  useEffect(() => {
    console.log('High scores updated:', highScores);
  }, [highScores]);

  // Add the NameInputOverlay component
  const NameInputOverlay = () => (
    <View style={styles.nameInputOverlay}>
      <View style={styles.nameInputDialog}>
        <Text style={styles.nameInputTitle}>New High Score! 🎉</Text>
        <Text style={styles.nameInputSubtitle}>Enter your initials:</Text>
        <TextInput
          style={styles.nameInput}
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={3}
          autoCapitalize="characters"
          autoFocus
        />
        <TouchableOpacity 
          style={[styles.button, !playerName && styles.buttonDisabled]}
          disabled={!playerName}
          onPress={submitScore}
        >
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Update the submitScore function
  const submitScore = async () => {
    if (!playerName) return;
    
    console.log('Submitting score:', {
      level: currentLevel,
      score,
      playerName,
      currentHighScores: highScores[currentLevel]
    });
    
    const newScore = {
      score,
      date: new Date().toLocaleDateString(),
      playerName: playerName.toUpperCase()
    };

    // Make sure we're working with an array
    let currentLevelScores = Array.isArray(highScores[currentLevel]) 
      ? highScores[currentLevel] 
      : [];

    // Create new array with the new score
    currentLevelScores = [...currentLevelScores, newScore];
    
    // Sort scores in descending order
    currentLevelScores.sort((a, b) => b.score - a.score);
    
    // Keep only top 10 scores
    currentLevelScores = currentLevelScores.slice(0, 10);

    // Create updated high scores object
    const updatedScores = {
      ...highScores,
      [currentLevel]: currentLevelScores
    };

    try {
      console.log('Saving updated scores:', updatedScores);
      await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(updatedScores));
      setHighScores(updatedScores);
      
      // Reset states in the correct order
      setShowNameInput(false);
      setPlayerName('');
      setGameStatus('ended');
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  // Add this useEffect to monitor state changes
  useEffect(() => {
    console.log('Game Status:', gameStatus);
    console.log('Show Name Input:', showNameInput);
    console.log('Player Name:', playerName);
  }, [gameStatus, showNameInput, playerName]);

  // Add Leaderboard component
  const Leaderboard = ({ level }: { level: number }) => {
    const scores = highScores[level] || [];
    
    return (
      <View style={styles.leaderboard}>
        <Text style={styles.leaderboardTitle}>{LEVELS[level].name} Leaderboard</Text>
        {scores.length === 0 ? (
          <Text style={styles.noScores}>No scores yet!</Text>
        ) : (
          scores.map((score, index) => (
            <View key={index} style={styles.scoreRow}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.playerName}>{score.playerName}</Text>
              <Text style={styles.scoreValue}>{score.score}</Text>
              <Text style={styles.scoreDate}>{score.date}</Text>
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Game header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fly Swatter!</Text>
        <Text style={styles.timer}>Time: {timeLeft}s</Text>
        <Text style={styles.score}>Score: {score}</Text>
      </View>

      {/* Game area */}
      {gameStatus === 'playing' && (
        <View style={styles.gameArea}>
          {flies.map((fly: {id: string; position: {top: number; left: number}}) => (
            <Fly
              key={fly.id}
              id={fly.id}
              position={fly.position}
              onCatch={catchFly}
            />
          ))}
          {splats.map((position: {top: number; left: number}, index: number) => (
            <Splat key={index} position={position} />
          ))}
          {isNewHighScore && (
            <Animated.View style={styles.newHighScoreAlert}>
              <Text style={styles.newHighScoreText}>New High Score! 🎉</Text>
            </Animated.View>
          )}
        </View>
      )}

      {/* Countdown overlay */}
      {gameStatus === 'countdown' && countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* Game over screen */}
      {gameStatus === 'ended' && (
        <View style={styles.overlay}>
          <Text style={styles.gameOver}>Game Over!</Text>
          <Text style={styles.finalScore}>Score: {score}</Text>
          <Leaderboard level={currentLevel} />
          <TouchableOpacity 
            style={styles.button}
            onPress={() => setGameStatus('idle')}
          >
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Level selection */}
      {gameStatus === 'idle' && (
        <View style={styles.buttonContainer}>
          {LEVELS.map((level, index) => (
            <TouchableOpacity
              key={level.name}
              style={[
                styles.levelButton,
                currentLevel === index ? styles.selectedLevel : null
              ]}
              onPress={() => {
                selectLevel(index);
                startGame();
              }}
            >
              <Text style={styles.buttonText}>{level.name}</Text>
              <Text style={styles.levelDetails}>
                High Score: {highScores[index]?.[0]?.score ?? 0}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Add name input overlay */}
      {showNameInput && <NameInputOverlay />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    marginTop: 5,
  },
  timer: {
    fontSize: 20,
    color: 'white',
    marginTop: 5,
  },
  score: {
    fontSize: 20,
    color: 'white',
    marginTop: 5,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  instructions: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  levelButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    maxWidth: 300,
    marginVertical: 10,
    alignItems: 'center',
  },
  selectedLevel: {
    backgroundColor: '#2E7D32',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  levelDetails: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
    opacity: 0.9,
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 40,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  countdownText: {
    fontSize: 100,
    fontWeight: 'bold',
    color: 'white',
  },
  gameOver: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  finalScore: {
    fontSize: 24,
    color: 'white',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  fly: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flyImage: {
    width: '100%',
    height: '100%',
  },
  flyEmoji: {
    fontSize: 35,
    lineHeight: 40,
    textAlign: 'center',
    includeFontPadding: false,
  },
  splat: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splatImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  splatEmoji: {
    fontSize: 30,
  },
  newHighScoreAlert: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  newHighScoreText: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  nameInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  nameInputDialog: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  nameInputTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  nameInputSubtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 10,
    width: '100%',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  leaderboard: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    marginVertical: 20,
  },
  leaderboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    marginVertical: 2,
    borderRadius: 4,
  },
  rank: {
    color: 'white',
    width: 40,
  },
  playerName: {
    color: 'white',
    width: 80,
    textAlign: 'center',
  },
  scoreValue: {
    color: 'white',
    width: 60,
    textAlign: 'right',
  },
  scoreDate: {
    color: 'white',
    width: 100,
    textAlign: 'right',
    fontSize: 12,
  },
  noScores: {
    color: 'white',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});