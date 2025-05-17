import { 
  sessions, type Session, type InsertSession,
  exchanges, type Exchange, type InsertExchange,
  dailyCounters, type DailyCounter, type InsertCounter,
  users, type User, type InsertUser 
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, gt } from "drizzle-orm";

// Storage interface with all required methods
export interface IStorage {
  // Session management
  getSession(email: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;

  // Chat exchanges
  getExchangesByEmail(email: string, limit?: number): Promise<Exchange[]>;
  saveExchange(exchange: InsertExchange): Promise<Exchange>;

  // Daily counters
  getDailyCounter(email: string, date: Date): Promise<DailyCounter | undefined>;
  createDailyCounter(counter: InsertCounter): Promise<DailyCounter>;
  incrementDailyCounter(email: string, date: Date): Promise<DailyCounter>;
  
  // Backwards compatibility (original User methods)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // Session management
  async getSession(email: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.email, email));
    return session;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db
      .insert(sessions)
      .values({ ...insertSession })
      .onConflictDoUpdate({
        target: sessions.email,
        set: { lastAccess: new Date() },
      })
      .returning();
    return session;
  }

  // Chat exchanges
  async getExchangesByEmail(email: string, limit: number = 50): Promise<Exchange[]> {
    return await db
      .select()
      .from(exchanges)
      .where(eq(exchanges.email, email))
      .orderBy(desc(exchanges.timestamp))
      .limit(limit);
  }

  async saveExchange(exchange: InsertExchange): Promise<Exchange> {
    const [savedExchange] = await db
      .insert(exchanges)
      .values(exchange)
      .returning();
    return savedExchange;
  }

  // Daily counters
  async getDailyCounter(email: string, date: Date): Promise<DailyCounter | undefined> {
    // Format the date to keep only the date part (no time)
    const formattedDate = new Date(date);
    formattedDate.setHours(0, 0, 0, 0);
    
    const [counter] = await db
      .select()
      .from(dailyCounters)
      .where(
        and(
          eq(dailyCounters.email, email),
          eq(dailyCounters.date, formattedDate)
        )
      );
    
    return counter;
  }

  async createDailyCounter(counter: InsertCounter): Promise<DailyCounter> {
    const [newCounter] = await db
      .insert(dailyCounters)
      .values(counter)
      .returning();
    
    return newCounter;
  }

  async incrementDailyCounter(email: string, date: Date): Promise<DailyCounter> {
    // Format the date to keep only the date part (no time)
    const formattedDate = new Date(date);
    formattedDate.setHours(0, 0, 0, 0);
    
    // First check if counter exists for this date and user
    let counter = await this.getDailyCounter(email, formattedDate);
    
    if (!counter) {
      // Create a new counter
      counter = await this.createDailyCounter({ 
        email, 
        date: formattedDate, 
        count: 1 
      });
    } else {
      // Increment existing counter
      const [updated] = await db
        .update(dailyCounters)
        .set({ count: counter.count + 1 })
        .where(
          and(
            eq(dailyCounters.email, email),
            eq(dailyCounters.date, formattedDate)
          )
        )
        .returning();
      
      counter = updated;
    }
    
    return counter;
  }
  
  // Backwards compatibility (original User methods)
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
