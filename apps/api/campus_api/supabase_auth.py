"""Supabase verification boundary; not yet wired to the API's authentication dependency."""

import re
from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

import jwt


class InvalidSupabaseSession(ValueError):
    """Token or authoritative session state cannot establish a portal user."""


@dataclass(frozen=True)
class VerifiedSupabaseSession:
    subject: str
    user_id: str
    session_id: str
    aal: str


class SupabaseSessionVerifier:
    def __init__(
        self,
        project_ref: str,
        session_is_active: Callable[[str, str], bool],
    ):
        # Hosted project only. Never use token-supplied iss/jku/x5u as network destinations.
        if not re.fullmatch(r"[a-z]{20}", project_ref):
            raise ValueError("Configure an exact hosted Supabase project reference")
        if not callable(session_is_active):
            raise ValueError("Authoritative session validation is required")
        self.issuer = f"https://{project_ref}.supabase.co/auth/v1"
        self.jwks = jwt.PyJWKClient(f"{self.issuer}/.well-known/jwks.json", timeout=5, lifespan=60)
        self.session_is_active = session_is_active

    def verify(self, token: str, *, require_mfa: bool = False) -> VerifiedSupabaseSession:
        try:
            if not isinstance(token, str) or not 1 <= len(token) <= 16384:
                raise InvalidSupabaseSession()
            header = jwt.get_unverified_header(token)
            if header.get("alg") not in ("ES256", "RS256"):
                raise InvalidSupabaseSession()
            if not isinstance(header.get("kid"), str) or not 1 <= len(header["kid"]) <= 200:
                raise InvalidSupabaseSession()
            if header.get("crit"):
                raise InvalidSupabaseSession()
            key = self.jwks.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                key.key,
                algorithms=["ES256", "RS256"],
                issuer=self.issuer,
                audience="authenticated",
                options={
                    "require": [
                        "iss",
                        "aud",
                        "exp",
                        "iat",
                        "sub",
                        "session_id",
                        "role",
                        "aal",
                        "is_anonymous",
                    ],
                    "strict_aud": True,
                },
                leeway=30,
            )
            for field in ("sub", "session_id"):
                value = claims[field]
                if not isinstance(value, str) or str(UUID(value)) != value:
                    raise InvalidSupabaseSession()
            if (
                claims["role"] != "authenticated"
                or claims["is_anonymous"] is not False
                or claims["aal"] not in ("aal1", "aal2")
                or (require_mfa and claims["aal"] != "aal2")
                or type(claims["iat"]) is not int
                or type(claims["exp"]) is not int
                or claims["exp"] <= claims["iat"]
            ):
                raise InvalidSupabaseSession()
            # Callback must check this exact user/session pair, expiry and revocation.
            # A missing session, backend outage or non-boolean response fails closed.
            if self.session_is_active(claims["sub"], claims["session_id"]) is not True:
                raise InvalidSupabaseSession()
            return VerifiedSupabaseSession(
                subject=f"{self.issuer}|{claims['sub']}",
                user_id=claims["sub"],
                session_id=claims["session_id"],
                aal=claims["aal"],
            )
        except Exception as exc:
            # Never include bearer tokens, raw claims or provider errors in public errors.
            raise InvalidSupabaseSession("Invalid or unavailable Supabase session") from exc
