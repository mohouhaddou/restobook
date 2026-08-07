import {
  Activity, Atom, BookOpen, Brain, CirclePlay, Dices, Dumbbell, FlaskConical,
  Gamepad2, GraduationCap, Heart, Landmark, Medal, Music2, Newspaper, Palette,
  PawPrint, Rocket, Shield, Sparkles, Trophy, Users, Video,
} from 'lucide-react';

export const PORTAL_CONFIG = {
  sports: {
    name: 'iFilino Sports',
    root: '/sports',
    heroIcon: Trophy,
    nav: [
      ['news', Newspaper], ['matches', Activity], ['live', CirclePlay],
      ['competitions', Trophy], ['clubs', Shield], ['players', Users],
      ['standings', Medal], ['statistics', Dumbbell], ['videos', Video], ['community', Heart],
    ],
  },
  kids: {
    name: 'iFilino Kids',
    root: '/kids',
    heroIcon: Sparkles,
    nav: [
      ['learn', GraduationCap], ['games', Gamepad2], ['stories', BookOpen],
      ['quizzes', Brain], ['science', FlaskConical], ['space', Rocket],
      ['animals', PawPrint], ['nature', Atom], ['drawing', Palette], ['coloring', Palette],
      ['music', Music2], ['videos', Video], ['audiobooks', CirclePlay], ['crafts', Dices], ['parents', Landmark],
    ],
  },
};
