import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { config } from "../../core/config.js";
import { getDatabase } from "../../db/mongo.js";
import {
  GuestProfileRequestSchema,
  LoginRequestSchema,
  ShortlistItemInputSchema,
  ShortlistItemUpdateSchema,
  SignupRequestSchema,
  UserProfileUpdateSchema,
} from "../../models/user.js";
import {
  hashPassword,
  issueAccessToken,
  tokenFromAuthorizationHeader,
  verifyAccessToken,
  verifyGoogleIdToken,
  verifyPassword,
} from "../../services/authService.js";
import {
  computeGuestPersonalization,
  createUser,
  ensureShareToken,
  findUserByEmail,
  findUserByGoogleSub,
  findUserById,
  getSharedShortlist,
  hydrateShortlist,
  mergeGoogleIdentity,
  removeShortlistItem,
  sanitizeUser,
  updateShortlistItem,
  updateUserProfile,
  upsertShortlistItem,
} from "../../services/userProfileService.js";

export const usersRouter = Router();

async function authenticatedUser(req: Request, res: Response): Promise<Record<string, any> | null> {
  const token = tokenFromAuthorizationHeader(req.header("authorization"));
  if (!token) {
    res.status(401).json({ error: "Bearer access token required." });
    return null;
  }
  try {
    const claims = verifyAccessToken(token);
    const user = await findUserById(getDatabase(), claims.sub);
    if (!user) {
      res.status(401).json({ error: "User account no longer exists." });
      return null;
    }
    return user;
  } catch (error) {
    res.status(401).json({ error: (error as Error).message });
    return null;
  }
}

function authResponse(user: Record<string, any>) {
  return {
    access_token: issueAccessToken(String(user._id), String(user.email)),
    token_type: "Bearer",
    expires_in: config.JWT_TTL_SECONDS,
    user: sanitizeUser(user),
  };
}

usersRouter.post("/guest-profile", async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = GuestProfileRequestSchema.parse(req.body);
    res.json(computeGuestPersonalization(profile));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

usersRouter.post("/signup", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = SignupRequestSchema.parse(req.body);
    const db = getDatabase();
    let email: string;
    let googleSub: string | undefined;

    if (parsed.google_id_token) {
      const identity = await verifyGoogleIdToken(parsed.google_id_token);
      if (parsed.email && identity.email !== parsed.email) {
        res.status(400).json({ error: "Google account email does not match signup email." });
        return;
      }
      email = identity.email;
      googleSub = identity.sub;
    } else if (parsed.email) {
      email = parsed.email;
    } else {
      res.status(400).json({ error: "Email is required for password signup." });
      return;
    }

    const existing = await findUserByEmail(db, email);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const user = await createUser(db, {
      email,
      password_hash: parsed.password ? hashPassword(parsed.password) : undefined,
      google_sub: googleSub,
      guest_profile: parsed.guest_profile,
      guest_saved_properties: parsed.guest_saved_properties,
    });
    res.status(201).json(authResponse(user as any));
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ error: "Account identity is already registered." });
      return;
    }
    res.status(400).json({ error: error?.message || "Unable to create account." });
  }
});

usersRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = LoginRequestSchema.parse(req.body);
    const db = getDatabase();
    let user: Record<string, any> | null = null;

    if (parsed.google_id_token) {
      const identity = await verifyGoogleIdToken(parsed.google_id_token);
      user = await findUserByGoogleSub(db, identity.sub);
      if (!user) {
        user = await findUserByEmail(db, identity.email);
        if (user) {
          await mergeGoogleIdentity(db, user._id as ObjectId, identity.sub);
          user = await findUserById(db, String(user._id));
        } else {
          user = (await createUser(db, {
            email: identity.email,
            google_sub: identity.sub,
          })) as any;
        }
      }
    } else {
      user = parsed.email ? await findUserByEmail(db, parsed.email) : null;
      if (!user || !parsed.password || !user.password_hash || !verifyPassword(parsed.password, user.password_hash)) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }
    }

    if (!user) {
      res.status(401).json({ error: "Unable to authenticate account." });
      return;
    }
    res.json(authResponse(user));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

usersRouter.get("/me", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  const safe = sanitizeUser(user);
  res.json({
    ...safe,
    shortlists: await hydrateShortlist(getDatabase(), safe.shortlists as any),
  });
});

usersRouter.put("/me", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  try {
    const parsed = UserProfileUpdateSchema.parse(req.body);
    const updated = await updateUserProfile(getDatabase(), user, parsed as any);
    if (!updated) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json(sanitizeUser(updated));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

usersRouter.get("/shortlist", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  const items = await hydrateShortlist(getDatabase(), Array.isArray(user.shortlists) ? user.shortlists : []);
  res.json({ items, count: items.length });
});

usersRouter.post("/shortlist", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  try {
    const parsed = ShortlistItemInputSchema.parse(req.body);
    const items = await upsertShortlistItem(getDatabase(), user, parsed);
    res.status(201).json({ items, count: items.length });
  } catch (error) {
    const message = (error as Error).message;
    res.status(message === "Property not found." ? 404 : 400).json({ error: message });
  }
});

usersRouter.patch("/shortlist/:propertyId", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  try {
    const propertyId = Array.isArray(req.params.propertyId) ? req.params.propertyId[0] : req.params.propertyId;
    const patch = ShortlistItemUpdateSchema.parse(req.body);
    const item = await updateShortlistItem(getDatabase(), user, propertyId, patch);
    if (!item) {
      res.status(404).json({ error: "Shortlist item not found." });
      return;
    }
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

usersRouter.delete("/shortlist/:propertyId", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  const propertyId = Array.isArray(req.params.propertyId) ? req.params.propertyId[0] : req.params.propertyId;
  const removed = await removeShortlistItem(getDatabase(), user, propertyId);
  if (!removed) {
    res.status(404).json({ error: "Shortlist item not found." });
    return;
  }
  res.status(204).send();
});

usersRouter.post("/shortlist/share", async (req: Request, res: Response): Promise<void> => {
  const user = await authenticatedUser(req, res);
  if (!user) return;
  try {
    const shareId = await ensureShareToken(getDatabase(), user);
    res.json({
      share_id: shareId,
      share_url: `${config.SITE_URL.replace(/\/$/, "")}/shortlist/${shareId}`,
      read_only: true,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

usersRouter.get("/shortlist/share/:shareId", async (req: Request, res: Response): Promise<void> => {
  const shareId = Array.isArray(req.params.shareId) ? req.params.shareId[0] : req.params.shareId;
  if (!/^sh-[A-Za-z0-9_-]{8,}$/.test(shareId)) {
    res.status(400).json({ error: "Invalid share id." });
    return;
  }
  const shared = await getSharedShortlist(getDatabase(), shareId);
  if (!shared) {
    res.status(404).json({ error: "Shared shortlist not found." });
    return;
  }
  res.json(shared);
});
