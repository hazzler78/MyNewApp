import { Text, View, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform, Image } from "react-native";
import { useState, useEffect, useRef } from "react";
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
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

type HighScores = {
  beginner: number;
  advanced: number;
  expert: number;
};

const LEVELS: Level[] = [
  {
    name: "Beginner",
    timeLimit: 15,
    numberOfFlies: 4,
    pointsPerFly: 1,
    colors: ['#a8e6cf', '#dcedc1'] as const
  },
  {
    name: "Advanced",
    timeLimit: 20,
    numberOfFlies: 3,
    pointsPerFly: 1,
    colors: ['#ffd3b6', '#ffaaa5'] as const
  },
  {
    name: "Expert",
    timeLimit: 25,
    numberOfFlies: 2,
    pointsPerFly: 1,
    colors: ['#ff8b94', '#ff6b6b'] as const
  }
];

// Add this component before the main Index component
const Fly = ({ id, position, onCatch }: { id: string; position: { top: number; left: number }; onCatch: (id: string, position: { top: number; left: number }) => void }) => {
  return (
    <TouchableOpacity
      onPress={() => onCatch(id, position)}
      style={[
        styles.fly,
        {
          top: position.top,
          left: position.left,
        },
      ]}
    >
      <Text style={styles.flyEmoji}>
        {Platform.OS === 'web' ? '🪰' : '🪰'}
      </Text>
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
      <Text style={styles.splatEmoji}>
        {Platform.OS === 'web' ? '💥' : '💥'}
      </Text>
    </View>
  );
};

export default function Index() {
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highScores, setHighScores] = useState<{ [key: number]: number }>({
    0: 0, // Beginner
    1: 0, // Advanced
    2: 0  // Expert
  });
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });
  const [splats, setSplats] = useState<Array<{top: number, left: number}>>([]);
  const rotation = useRef(new Animated.Value(0)).current;
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStatus, setGameStatus] = useState<'idle' | 'countdown' | 'playing' | 'ended'>('idle');
  const [flies, setFlies] = useState<Fly[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [showScoreAnimation, setShowScoreAnimation] = useState(false);
  const gameAreaRef = useRef<View>(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('Current level:', currentLevel);
    console.log('Number of flies:', LEVELS[currentLevel].numberOfFlies);
    console.log('Actual flies:', flies.length);
  }, [currentLevel, flies]);

  const startGame = () => {
    setFlies([]);
    setSplats([]);
    setScore(0);
    setGameStatus('countdown');
    setCountdown(3);
    setIsPlaying(false);

    // Start countdown
    let count = 3;
    const countdownTimer = setInterval(() => {
      count -= 1;
      setCountdown(count);
      
      if (count <= 0) {
        clearInterval(countdownTimer);
        // Start game after countdown
        setTimeout(() => {
          setGameStatus('playing');
          setTimeLeft(LEVELS[currentLevel].timeLimit);
          setGameStartTime(Date.now());
          setIsPlaying(true);
          updateFliesPositions();
        }, 1000);
      }
    }, 1000);
  };

  // Separate useEffect for game timer
  useEffect(() => {
    let gameTimer: NodeJS.Timeout;

    if (isPlaying && timeLeft > 0) {
      gameTimer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            clearInterval(gameTimer);
            setIsPlaying(false);
            setGameStatus('ended');
            updateHighScore(score);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (gameTimer) {
        clearInterval(gameTimer);
      }
    };
  }, [isPlaying]);

  // Separate useEffect for fly updates
  useEffect(() => {
    if (isPlaying) {
      updateFliesPositions();
    }
  }, [isPlaying]);

  const updateFliesPositions = () => {
    console.log('Updating flies positions for level:', currentLevel);
    const levelFlies = LEVELS[currentLevel].numberOfFlies;
    
    const newFlies = Array.from({ length: levelFlies }, (_, i) => ({
      id: `fly-${Date.now()}-${i}`,
      position: generateNewFlyPosition()
    }));
    
    setFlies(newFlies);
  };

  const catchFly = (flyId: string, position: { top: number; left: number }) => {
    if (!isPlaying || timeLeft <= 0) return;

    // Add splat effect
    setSplats(prev => [...prev, position]);

    // Update score with animation
    setScore(prev => prev + 1);

    // Remove caught fly and add new one
    setFlies(prev => {
      const remaining = prev.filter(f => f.id !== flyId);
      return [
        ...remaining,
        {
          id: `fly-${Date.now()}`,
          position: generateNewFlyPosition()
        }
      ];
    });

    // Optional: Add shake effect to game area
    if (gameAreaRef.current) {
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 5,
          duration: 50,
          useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
          toValue: -5,
          duration: 50,
          useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true
        })
      ]).start();
    }
  };

  const getCurrentLevelHighScore = () => {
    return highScores[currentLevel] || 0;
  };

  const updateHighScore = async (newScore: number) => {
    if (newScore > (highScores[currentLevel] || 0)) {
      const newHighScores = {
        ...highScores,
        [currentLevel]: newScore
      };
      setHighScores(newHighScores);
      try {
        await AsyncStorage.setItem('highScores', JSON.stringify(newHighScores));
      } catch (error) {
        console.log('Error saving high score:', error);
      }
    }
  };

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotation, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true
          }),
          Animated.timing(rotation, {
            toValue: -1,
            duration: 100,
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      rotation.setValue(0);
    }
  }, [isPlaying]);

  const generateNewFlyPosition = () => {
    const screenHeight = Dimensions.get('window').height;
    const screenWidth = Dimensions.get('window').width;
    const buttonSize = 80;
    const headerSpace = 200;
    const safeMargin = 20;
    
    return {
      top: headerSpace + (Math.random() * (screenHeight - buttonSize - headerSpace - safeMargin)),
      left: safeMargin + (Math.random() * (screenWidth - buttonSize - (safeMargin * 2))),
    };
  };

  const returnToLevelSelect = () => {
    setGameStatus('idle');
    setCount(0);
    setScore(0);
    setSplats([]);
    setFlies([]);
    setIsPlaying(false);
  };

  const spin = rotation.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-30deg', '30deg']
  });

  const selectLevel = (level: number) => {
    console.log('Selecting level:', level);
    setCurrentLevel(level);
    startGame();
  };

  // Load high scores when app starts
  useEffect(() => {
    loadHighScores();
  }, []);

  const loadHighScores = async () => {
    try {
      const savedScores = await AsyncStorage.getItem('highScores');
      if (savedScores) {
        setHighScores(JSON.parse(savedScores));
      }
    } catch (error) {
      console.log('Error loading high scores:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fly Swatter!</Text>
        <Text style={styles.subtitle}>
          Level: {LEVELS[currentLevel].name}
        </Text>
        <Text style={styles.timer}>Time: {timeLeft}s</Text>
        <Text style={styles.score}>Score: {score}</Text>
      </View>

      {/* Level Selection Screen */}
      {gameStatus === 'idle' && (
        <View style={styles.buttonContainer}>
          <Text style={styles.instructions}>Select Difficulty:</Text>
          {LEVELS.map((level, index) => (
            <TouchableOpacity 
              key={level.name}
              style={[
                styles.levelButton,
                currentLevel === index ? styles.selectedLevel : null
              ]}
              onPress={() => selectLevel(index)}
            >
              <Text style={styles.buttonText}>{level.name}</Text>
              <Text style={styles.levelDetails}>
                {level.numberOfFlies} flies • {level.timeLimit}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Countdown Screen */}
      {gameStatus === 'countdown' && (
        <View style={styles.overlay}>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>
      )}

      {/* Game Area */}
      {(gameStatus === 'playing' || gameStatus === 'countdown') && (
        <View style={styles.gameArea} ref={gameAreaRef}>
          {flies.map(fly => (
            <Fly
              key={fly.id}
              id={fly.id}
              position={fly.position}
              onCatch={catchFly}
            />
          ))}
          {splats.map((position, index) => (
            <Splat key={index} position={position} />
          ))}
        </View>
      )}

      {/* Game Over Screen */}
      {gameStatus === 'ended' && (
        <View style={styles.overlay}>
          <Text style={styles.gameOver}>Game Over!</Text>
          <Text style={styles.finalScore}>Score: {score}</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => setGameStatus('idle')}
          >
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}
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
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
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
  countdown: {
    fontSize: 72,
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
    minWidth: 200,
    alignItems: 'center',
  },
  fly: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flyEmoji: {
    fontSize: 30,
  },
  splat: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splatEmoji: {
    fontSize: 30,
  },
});