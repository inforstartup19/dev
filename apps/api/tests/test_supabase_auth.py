import time
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa

from campus_api.supabase_auth import InvalidSupabaseSession, SupabaseSessionVerifier


@pytest.fixture(params=["ES256", "RS256"])
def supabase_token(request):
    algorithm = request.param
    private = (
        ec.generate_private_key(ec.SECP256R1())
        if algorithm == "ES256"
        else rsa.generate_private_key(public_exponent=65537, key_size=2048)
    )
    active = Mock(return_value=True)
    verifier = SupabaseSessionVerifier("shnitfrpgzhwobsuotdl", active)
    verifier.jwks = SimpleNamespace(
        get_signing_key_from_jwt=Mock(return_value=SimpleNamespace(key=private.public_key()))
    )
    now = int(time.time())
    claims = dict(
        iss=verifier.issuer,
        aud="authenticated",
        sub=str(uuid4()),
        session_id=str(uuid4()),
        exp=now + 300,
        iat=now,
        aal="aal1",
        role="authenticated",
        is_anonymous=False,
    )

    def mint(changes=None, omit=None):
        payload = {**claims, **(changes or {})}
        if omit:
            payload.pop(omit)
        return jwt.encode(payload, private, algorithm=algorithm, headers={"kid": "test-key"})

    return verifier, active, claims, mint


def test_valid_session_is_bound_to_user_and_not_metadata(supabase_token):
    verifier, active, claims, mint = supabase_token
    session = verifier.verify(mint({"user_metadata": {"role": "teacher", "aal": "aal2"}}))
    assert session.subject == f"{verifier.issuer}|{claims['sub']}"
    assert session.aal == "aal1"
    active.assert_called_once_with(claims["sub"], claims["session_id"])
    assert not hasattr(session, "role")


@pytest.mark.parametrize(
    "changes",
    [
        {"iss": "https://hspebdejfdilkuanhwfv.supabase.co/auth/v1"},
        {"aud": "anon"},
        {"aud": ["authenticated", "other"]},
        {"role": "service_role"},
        {"role": "teacher"},
        {"is_anonymous": True},
        {"is_anonymous": "false"},
        {"aal": "aal3"},
        {"sub": "student"},
        {"session_id": ""},
        {"exp": 1},
        {"iat": 9999999999},
        {"exp": "9999999999"},
    ],
)
def test_invalid_claims_never_reach_session_lookup(supabase_token, changes):
    verifier, active, _, mint = supabase_token
    with pytest.raises(InvalidSupabaseSession):
        verifier.verify(mint(changes))
    active.assert_not_called()


@pytest.mark.parametrize("field", ["session_id", "sub", "role", "is_anonymous", "aal"])
def test_missing_claims_are_rejected(supabase_token, field):
    verifier, active, _, mint = supabase_token
    with pytest.raises(InvalidSupabaseSession):
        verifier.verify(mint(omit=field))
    active.assert_not_called()


def test_mfa_is_taken_only_from_verified_aal(supabase_token):
    verifier, active, _, mint = supabase_token
    with pytest.raises(InvalidSupabaseSession):
        verifier.verify(mint({"user_metadata": {"aal": "aal2"}}), require_mfa=True)
    active.assert_not_called()
    assert verifier.verify(mint({"aal": "aal2"}), require_mfa=True).aal == "aal2"


@pytest.mark.parametrize("state", [False, None, 1, "true", RuntimeError("offline")])
def test_revoked_missing_or_unavailable_sessions_fail_closed(supabase_token, state):
    verifier, active, _, mint = supabase_token
    if isinstance(state, Exception):
        active.side_effect = state
    else:
        active.return_value = state
    with pytest.raises(InvalidSupabaseSession, match="Invalid or unavailable"):
        verifier.verify(mint())


def test_wrong_signature_and_jwks_failure(supabase_token):
    verifier, active, _, mint = supabase_token
    verifier.jwks.get_signing_key_from_jwt.return_value.key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048
    ).public_key()
    with pytest.raises(InvalidSupabaseSession):
        verifier.verify(mint())
    verifier.jwks.get_signing_key_from_jwt.side_effect = RuntimeError("offline")
    with pytest.raises(InvalidSupabaseSession):
        verifier.verify(mint())
    active.assert_not_called()


@pytest.mark.parametrize(
    "token",
    [
        "",
        "x" * 16385,
        None,
        jwt.encode({"sub": "user"}, "test-only-key-of-at-least-32-bytes", algorithm="HS256"),
        jwt.encode({"sub": "user"}, None, algorithm="none"),
    ],
)
def test_unsupported_tokens_do_not_fetch_keys(token):
    verifier = SupabaseSessionVerifier("shnitfrpgzhwobsuotdl", Mock(return_value=True))
    verifier.jwks = Mock()
    with pytest.raises(InvalidSupabaseSession):
        verifier.verify(token)
    verifier.jwks.get_signing_key_from_jwt.assert_not_called()


def test_configuration_requires_project_and_session_authority():
    for project in ("", "https://attacker.example", "abc/../../auth"):
        with pytest.raises(ValueError):
            SupabaseSessionVerifier(project, lambda *_: True)
    with pytest.raises(ValueError):
        SupabaseSessionVerifier("shnitfrpgzhwobsuotdl", None)
